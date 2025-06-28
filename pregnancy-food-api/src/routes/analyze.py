import os
import base64
import json
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
import requests
import google.generativeai as genai

analyze_bp = Blueprint('analyze', __name__)

# 妊娠中に避けるべき食品のリスト
AVOID_FOODS = {
    'raw_fish': {
        'keywords': ['刺身', 'さしみ', 'sashimi', '生魚', '寿司', 'sushi', 'マグロ', 'サーモン'],
        'message': '生魚が含まれており、妊娠中は避けることをお勧めします',
        'details': '生魚にはリステリア菌や寄生虫のリスクがあります。詳しくは医師にご相談ください'
    },
    'raw_meat': {
        'keywords': ['ユッケ', 'レアステーキ', '生ハム', '生肉'],
        'message': '生肉が含まれており、妊娠中は避けることをお勧めします',
        'details': 'トキソプラズマやリステリア菌のリスクがあります。詳しくは医師にご相談ください'
    },
    'raw_egg': {
        'keywords': ['生卵', '半熟卵', 'カルボナーラ'],
        'message': '生卵が含まれており、妊娠中は注意が必要です',
        'details': 'サルモネラ菌のリスクがあります。詳しくは医師にご相談ください'
    },
    'soft_cheese': {
        'keywords': ['ナチュラルチーズ', 'カマンベール', 'ブルーチーズ'],
        'message': 'ナチュラルチーズが含まれており、妊娠中は避けることをお勧めします',
        'details': 'リステリア菌のリスクがあります。詳しくは医師にご相談ください'
    },
    'alcohol': {
        'keywords': ['アルコール', 'ワイン', 'ビール', '日本酒', '焼酎'],
        'message': 'アルコールが含まれており、妊娠中は摂取を避けてください',
        'details': '胎児の発育に影響を与える可能性があります。詳しくは医師にご相談ください'
    }
}

def analyze_image_mock(image_data):
    """
    モック画像分析関数
    実際の実装では、ここで画像認識APIを呼び出すか、
    機械学習モデルを使用して食材を識別する
    """
    # 実際の画像認識の代わりに、ランダムな結果を返す
    import random
    
    # 30%の確率で避けるべき食品を検出
    if random.random() < 0.3:
        food_type = random.choice(list(AVOID_FOODS.keys()))
        return {
            'safe': False,
            'detected_food': food_type,
            'message': AVOID_FOODS[food_type]['message'],
            'details': AVOID_FOODS[food_type]['details']
        }
    else:
        return {
            'safe': True,
            'detected_food': 'safe_food',
            'message': 'この食事は妊娠中でも安心してお召し上がりいただけます',
            'details': ''
        }

def call_gemini_api(image_data):
    api_key = os.environ.get('GEMINI_API_KEY')
    if not api_key:
        return {
            'safe': False,
            'detected_food': None,
            'message': 'Gemini APIキーが設定されていません',
            'details': ''
        }
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-1.5-flash')
    # 画像データ（data:image/...;base64,....）からbase64部分のみ抽出
    if ',' in image_data:
        image_b64 = image_data.split(',')[1]
    else:
        image_b64 = image_data
    import base64
    image_bytes = base64.b64decode(image_b64)
    prompt = (
        "妊婦がとる食事の画像を元に、そこに妊婦にとってリスクのある食材が含まれているかを判定する手助けをしてください。この画像に含まれる食品名をリストアップし、それぞれが妊婦にとってリスクがあるかどうかを判定してください。"
        "必ず次のJSON形式で返してください。"
        "\n\n"
        "{\n  \"foods\": [\n    {\"name\": \"食品名\", \"risk\": true/false, \"details\": \"リスクの説明（なければ空文字）\"},\n    ...\n  ]\n}"
        "\n\nリスクがある食品がなければ、'risk': false だけの配列で返してください。説明文や表は不要です。"
    )
    try:
        response = model.generate_content([
            prompt,
            {
                "mime_type": "image/jpeg",
                "data": image_bytes
            }
        ])
        import re
        # レスポンスからJSON部分を抽出
        text = response.text
        match = re.search(r'\{[\s\S]*\}', text)
        if not match:
            return {
                'safe': False,
                'detected_food': None,
                'message': 'GeminiのレスポンスからJSONを抽出できませんでした',
                'details': text
            }
        foods_json = match.group(0)
        try:
            foods_data = json.loads(foods_json)
            foods = foods_data.get('foods', [])
        except Exception as e:
            return {
                'safe': False,
                'detected_food': None,
                'message': f'GeminiのJSONパースエラー: {str(e)}',
                'details': foods_json
            }
        # リスク食品抽出
        risky_foods = [f for f in foods if f.get('risk')]
        safe = len(risky_foods) == 0
        if safe:
            message = 'この食事は妊娠中でも安心してお召し上がりいただけます'
            detected_food = []
            details = ''
        else:
            message = 'リスクがある食品が含まれています。詳細をご確認ください。'
            detected_food = [f['name'] for f in risky_foods]
            details = '\n'.join([f"{f['name']}: {f['details']}" for f in risky_foods])
        return {
            'safe': safe,
            'detected_food': detected_food,
            'message': message,
            'details': details
        }
    except Exception as e:
        return {
            'safe': False,
            'detected_food': None,
            'message': f'Gemini API呼び出しエラー: {str(e)}',
            'details': ''
        }

@analyze_bp.route('/analyze', methods=['POST'])
def analyze_food():
    """
    食事画像を分析するAPIエンドポイント
    """
    try:
        # リクエストからデータを取得
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'error': '画像データが提供されていません'
            }), 400
        
        image_data = data['image']
        
        # Base64画像データの検証（簡易）
        if not image_data.startswith('data:image/'):
            return jsonify({
                'error': '無効な画像形式です'
            }), 400
        
        # Gemini API呼び出し（Googleログイン不要）
        result = call_gemini_api(image_data)
        
        return jsonify({
            'success': True,
            'result': result
        })
        
    except Exception as e:
        return jsonify({
            'error': f'分析中にエラーが発生しました: {str(e)}'
        }), 500

@analyze_bp.route('/health', methods=['GET'])
def health_check():
    """
    ヘルスチェック用エンドポイント
    """
    return jsonify({
        'status': 'healthy',
        'message': '妊娠中の食事チェッカーAPI'
    })

@analyze_bp.route('/foods/avoid', methods=['GET'])
def get_avoid_foods():
    """
    避けるべき食品リストを取得するエンドポイント
    """
    return jsonify({
        'avoid_foods': AVOID_FOODS
    })

