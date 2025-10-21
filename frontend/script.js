document.addEventListener("DOMContentLoaded", () => {
    const recordButton = document.getElementById("recordButton");
    const statusText = document.getElementById("statusText");
    const audioPlayback = document.getElementById("audioPlayback");

    
    const SESSION_ID = "session_" + Date.now() + "_" + Math.random().toString(36).substring(2, 15);
    console.log("Using Session ID:", SESSION_ID); 

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        statusText.textContent = "Sorry, your browser doesn't support Speech Recognition.";
        recordButton.disabled = true;
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    let isRecording = false;

    recordButton.addEventListener("click", () => {
        if (isRecording) {
            recognition.stop();
        } else {
            
            audioPlayback.style.display = "none";
            audioPlayback.src = "";
            recognition.start();
        }
    });

    recognition.onstart = () => {
        isRecording = true;
        statusText.textContent = "Listening... 👂";
        recordButton.classList.add("is-recording");
    };

    recognition.onend = () => {
        isRecording = false;
        
        recordButton.classList.remove("is-recording");
        
        if (statusText.textContent === "Listening... 👂") {
            statusText.textContent = "Click the mic to speak";
        }
    };

    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error, event.message);
        statusText.textContent = `Speech Error: ${event.error}. Please try again.`;
        
        isRecording = false;
        recordButton.classList.remove("is-recording");
    };

    
    recognition.onresult = async (event) => {
        
        isRecording = false;
        recordButton.classList.remove("is-recording");

        const transcript = event.results[0][0].transcript;
        console.log("Transcript:", transcript);
        statusText.textContent = `You said: "${transcript}" (Processing... 🤔)`;

        try {
            console.log("Sending fetch request to backend with Session ID:", SESSION_ID);
            const response = await fetch("http://127.0.0.1:5000/api/chat-and-speak", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                
                body: JSON.stringify({
                    prompt: transcript,
                    session_id: SESSION_ID 
                }),
                
            });
            console.log("Received response from backend. Status:", response.status);

            if (!response.ok) {
                let errorMsg = `Server error: ${response.status} ${response.statusText}`;
                try {
                    const errorJson = await response.json();
                    console.error("Server error JSON:", errorJson);
                    errorMsg += ` - ${errorJson.error || 'Unknown server error detail'}`;
                } catch (e) { console.log("Response was not JSON."); }
                throw new Error(errorMsg);
            }

            const audioBlob = await response.blob();
            console.log("Received audio blob. Size:", audioBlob.size, "Type:", audioBlob.type);

           
            if (audioBlob.size < 1000 || !audioBlob.type.startsWith('audio/')) {
                
                console.warn("Received potentially invalid audio data based on size/type.");
                
            }

            const audioUrl = URL.createObjectURL(audioBlob);

            audioPlayback.src = audioUrl;
            audioPlayback.style.display = "block";

            
            audioPlayback.onended = () => {
                console.log("Audio playback finished.");
                statusText.textContent = "Click the mic to speak";
                URL.revokeObjectURL(audioUrl); 
            };

            
            audioPlayback.onerror = (e) => {
                console.error("Error playing audio:", e);
                statusText.textContent = "Error playing audio response.";
                audioPlayback.style.display = "none";
                audioPlayback.src = "";
                URL.revokeObjectURL(audioUrl); 
            };

            
            audioPlayback.play().catch(e => { 
                 console.error("Error initiating audio playback:", e);
                 statusText.textContent = "Error playing audio.";
                 audioPlayback.style.display = "none";
                 audioPlayback.src = "";
                 URL.revokeObjectURL(audioUrl); 
            });

            statusText.textContent = "Playing response... Click mic to speak again.";
            console.log("Audio playback initiated.");

        } catch (err) {
            console.error("Error fetching or playing audio:", err);
            statusText.textContent = `Error: ${err.message}. Check console & server logs.`;
            audioPlayback.style.display = "none";
            audioPlayback.src = "";
            
            isRecording = false;
            recordButton.classList.remove("is-recording");
            statusText.textContent = "Click the mic to speak"; 
        }
       
    };
});