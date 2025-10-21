from flask import Flask, jsonify, request, send_file
from dotenv import load_dotenv
import os, io, re, numpy as np, torch, soundfile as sf
from google import genai
from TTS.api import TTS
from flask_cors import CORS
from flask import send_from_directory
import os
import traceback


load_dotenv()
app = Flask(__name__)
CORS(app)


chat_sessions = {}

try:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"TTS using device: {device}")

    TTS_MODEL = "tts_models/en/ljspeech/vits"

    tts = TTS(TTS_MODEL).to(device)
    print(f"Loaded TTS model: {TTS_MODEL}")
    tts_sample_rate = getattr(tts.synthesizer, "output_sample_rate", 22050)
    
    print("Speakers:", getattr(tts, "speakers", None))
    print("Languages:", getattr(tts, "languages", None))

except Exception as e:
    print(f"Error loading Coqui TTS: {e}")
    exit()

try:
    client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
    print("Gemini client loaded successfully.")

    GEMINI_MODEL_NAME = "models/gemini-2.0-flash"
    print(f"Gemini model configured: {GEMINI_MODEL_NAME}")

except Exception as e:
    print(f"Error loading Gemini client: {e}")
    exit()





@app.route("/")
def serve_index():
    return send_from_directory("frontend", "index.html")

@app.route("/<path:path>")
def serve_static_files(path):
    return send_from_directory("frontend", path)



@app.route("/api/chat-and-speak", methods=["POST"])
def chat_and_speak():
    try:
        data = request.get_json()
        prompt = data.get("prompt")
      
        session_id = data.get("session_id")
       

        if not prompt:
            return jsonify({"error": "No prompt provided"}), 400
        
        if not session_id:
            return jsonify({"error": "No session_id provided"}), 400
      
        print(f"\n--- Request ---")
        print(f"Session [{session_id}] Prompt: {prompt}")
       
        if session_id not in chat_sessions:
            print(f"Creating new chat session: {session_id}")
        
            chat_sessions[session_id] = client.chats.create(model=GEMINI_MODEL_NAME)
            print(f"New session created for {session_id}")

        chat = chat_sessions[session_id]


        print(f"Sending prompt to Gemini for session {session_id}...")
        gemini_response = chat.send_message(prompt) 
       
        text = gemini_response.text.strip()
     
        print(f"Session [{session_id}] Gemini Raw Response: {text}")
      

        clean_text = re.sub(r"[*_`#~]", "", text).strip()
       
        if not clean_text:
             clean_text = "I received a response, but it was empty after cleaning."
    
        print(f"Session [{session_id}] Cleaned text: {clean_text}")
   
        print(f"Synthesizing audio for session {session_id}...")
  
        tts_kwargs = {"text": clean_text}
       
        wav = tts.tts(**tts_kwargs)

       
        if wav is None:
             print(f" TTS generation failed for session {session_id}, returned None.")
             
        
        if isinstance(wav, tuple):
             waveform = wav[0]
             sr = wav[1] if len(wav) > 1 and isinstance(wav[1], int) else tts_sample_rate
        else:
             waveform = wav
             sr = tts_sample_rate

        if not isinstance(sr, int): sr = 22050 
        waveform = np.array(waveform, dtype=np.float32)
      
        print(f"Audio synthesized successfully for session {session_id}.")
      
        audio_buffer = io.BytesIO()
        sf.write(audio_buffer, waveform, samplerate=sr, format="WAV")
        audio_buffer.seek(0)
        
        print(f"WAV data prepared for session {session_id}.")
      
        return send_file(audio_buffer, mimetype="audio/wav")

    except Exception as e:
        print(f"Error in /api/chat-and-speak: {e}")
      
        traceback.print_exc()
      
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)