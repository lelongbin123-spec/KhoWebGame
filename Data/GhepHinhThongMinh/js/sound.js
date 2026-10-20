// sound.js - Xử lý âm thanh & Giọng đọc AI Tiếng Việt
const SoundManager = {
    enabled: true,
    sounds: {},
    vietnameseVoice: null,
    // Set window.GOOGLE_TTS_ENDPOINT to a server proxy; keep the Google API key server-side.
    googleTtsEndpoint: null,
    googleTtsVoiceName: 'vi-VN-Wavenet-A',
    speechRequestId: 0,
    speechAudio: null,
    speechAudioUrl: null,
    audioCtx: null,
    initialized: false,

    init() {
        if (this.initialized) return;
        this.initialized = true;

        // Tải các file âm thanh từ thư mục assets
        this.sounds = {
            bay: new Audio('assets/audio/bay.m4a'),
            click: new Audio('assets/audio/click.m4a'),
            correct: new Audio('assets/audio/Correct.m4a'),
            wrong: new Audio('assets/audio/Wrong.m4a'),
            levelComplete: new Audio('assets/audio/complete.m4a'),
            finish: new Audio('assets/audio/finish.m4a')
        };
        
        // Thiết lập alias tương thích
        this.sounds.hint = this.sounds.bay;
        this.sounds.complete = this.sounds.levelComplete;

        // Thiết lập âm thanh bay (radar lướt)
        this.sounds.bay.loop = false;

        // Khởi tạo AudioContext
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        } catch (e) {}

        // Khởi tạo giọng đọc tiếng Việt cho AI
        this.googleTtsEndpoint = window.GOOGLE_TTS_ENDPOINT || null;
        this.initSpeechSynthesis();

        const toggleBtn = document.querySelector('.sound-toggle') || document.querySelector('.btn-sound') || document.getElementById('btn-sound');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.enabled = !this.enabled;
                toggleBtn.classList.toggle('muted', !this.enabled);
                toggleBtn.innerHTML = this.enabled ? '<i class="fa-solid fa-volume-high"></i>' : '<i class="fa-solid fa-volume-xmark"></i>';
                
                // Nếu đang tắt âm thanh, dừng mọi âm thanh & giọng đọc đang phát
                if (!this.enabled) {
                    this.stopAll();
                }
            });
        }
    },

    resumeContext() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    },

    initSpeechSynthesis() {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            this.loadVoices();
            window.speechSynthesis.addEventListener('voiceschanged', () => this.loadVoices());
        }
    },

    loadVoices() {
        if (!('speechSynthesis' in window)) return null;
        const voices = window.speechSynthesis.getVoices();
        const vietnameseVoices = voices.filter(voice => /^vi([_-]|$)/i.test(voice.lang || ''));
        const preferredVoice = vietnameseVoices.find(voice =>
            /natural|online|google|hoai ?my|nam ?minh/i.test(voice.name)
        );

        this.vietnameseVoice = preferredVoice || vietnameseVoices[0] || null;
        return this.vietnameseVoice;
    },

    async waitForVietnameseVoice(timeoutMs = 1500) {
        const voice = this.loadVoices();
        if (voice || !('speechSynthesis' in window)) return voice;

        return new Promise(resolve => {
            let timeoutId;
            const finish = () => {
                window.speechSynthesis.removeEventListener('voiceschanged', finish);
                clearTimeout(timeoutId);
                resolve(this.loadVoices());
            };

            window.speechSynthesis.addEventListener('voiceschanged', finish);
            timeoutId = setTimeout(finish, timeoutMs);
        });
    },

    async speak(text) {
        const message = String(text || '').trim();
        if (!this.enabled || !message) return;

        this.stopSpeech();
        const requestId = this.speechRequestId;

        if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
            await this.speakWithGoogleTts(message, requestId);
            return;
        }

        const voice = await this.waitForVietnameseVoice();
        if (requestId !== this.speechRequestId || !this.enabled) return;
        if (!voice) {
            await this.speakWithGoogleTts(message, requestId);
            return;
        }

        const utterance = new SpeechSynthesisUtterance(message);
        utterance.lang = 'vi-VN';
        utterance.voice = voice;
        utterance.rate = 0.92;
        utterance.pitch = 1.05;

        let handled = false;
        const fallbackToGoogle = () => {
            if (handled || requestId !== this.speechRequestId) return;
            handled = true;
            clearTimeout(watchdogId);
            window.speechSynthesis.cancel();
            this.speakWithGoogleTts(message, requestId);
        };
        const watchdogId = setTimeout(fallbackToGoogle, Math.min(120000, 10000 + message.length * 220));

        utterance.onend = () => {
            handled = true;
            clearTimeout(watchdogId);
        };
        utterance.onerror = event => {
            if (requestId !== this.speechRequestId || handled) return;
            console.warn('Web Speech API failed:', event.error);
            fallbackToGoogle();
        };

        try {
            window.speechSynthesis.speak(utterance);
        } catch (error) {
            console.warn('Web Speech API could not start:', error);
            fallbackToGoogle();
        }
    },

    async speakWithGoogleTts(text, requestId) {
        if (!this.googleTtsEndpoint || requestId !== this.speechRequestId || !this.enabled) return;

        try {
            const response = await fetch(this.googleTtsEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text },
                    voice: {
                        languageCode: 'vi-VN',
                        name: this.googleTtsVoiceName
                    },
                    audioConfig: {
                        audioEncoding: 'MP3',
                        speakingRate: 0.92,
                        pitch: 1.05
                    }
                })
            });
            if (!response.ok) throw new Error(`Google TTS endpoint returned ${response.status}`);

            const contentType = response.headers.get('content-type') || '';
            let audioBlob;
            if (contentType.includes('application/json')) {
                const result = await response.json();
                if (!result.audioContent) throw new Error('Google TTS response has no audioContent');
                const binary = atob(result.audioContent);
                const bytes = new Uint8Array(binary.length);
                for (let index = 0; index < binary.length; index++) {
                    bytes[index] = binary.charCodeAt(index);
                }
                audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
            } else {
                audioBlob = await response.blob();
            }

            if (requestId !== this.speechRequestId || !this.enabled) return;
            this.speechAudioUrl = URL.createObjectURL(audioBlob);
            this.speechAudio = new Audio(this.speechAudioUrl);
            this.speechAudio.addEventListener('ended', () => this.releaseSpeechAudio(), { once: true });
            this.speechAudio.addEventListener('error', () => this.releaseSpeechAudio(), { once: true });
            await this.speechAudio.play();
        } catch (error) {
            if (requestId === this.speechRequestId) {
                console.warn('Google TTS fallback failed:', error);
                this.releaseSpeechAudio();
            }
        }
    },

    releaseSpeechAudio() {
        if (this.speechAudio) {
            this.speechAudio.pause();
            this.speechAudio = null;
        }
        if (this.speechAudioUrl) {
            URL.revokeObjectURL(this.speechAudioUrl);
            this.speechAudioUrl = null;
        }
    },

    stopSpeech() {
        this.speechRequestId++;
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        this.releaseSpeechAudio();
    },

    playSound(name) {
        if (!this.enabled || !this.sounds[name]) return;
        this.resumeContext();
        
        // Reset thời gian và phát lại
        this.sounds[name].currentTime = 0;
        this.sounds[name].play().catch(e => console.log('Audio play failed:', e));
    },

    // Hàm gọi tương thích: SoundManager.play(name)
    play(name) {
        let soundKey = name;
        if (soundKey === 'hint') soundKey = 'bay';
        if (soundKey === 'complete') soundKey = 'levelComplete';
        this.playSound(soundKey);
    },

    stopSound(name) {
        let soundKey = name;
        if (soundKey === 'hint') soundKey = 'bay';
        if (soundKey === 'complete') soundKey = 'levelComplete';
        if (this.sounds[soundKey]) {
            this.sounds[soundKey].pause();
            this.sounds[soundKey].currentTime = 0;
        }
    },

    stopAll() {
        this.stopSpeech();
        Object.values(this.sounds).forEach(audio => {
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        });
    },

    playCorrect() {
        this.playSound('correct');
    },

    playWrong() {
        this.playSound('wrong');
    },
    
    playClick() {
        this.playSound('click');
    },

    playLevelComplete() {
        this.playSound('levelComplete');
    },

    playFinish() {
        this.playSound('finish');
    },

    startRadar() {
        if (!this.enabled) return;
        this.sounds.bay.play().catch(e => console.log('Audio play failed:', e));
    },

    stopRadar() {
        if (this.sounds.bay) {
            this.sounds.bay.pause();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => SoundManager.init());
