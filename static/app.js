const $ = (id) => document.getElementById(id);

let history = [];
let imageData = null;
let recorder = null;
let audioChunks = [];
let cameraStream = null;
let lastAnswer = '';

const headers = () => {
  const token = $('token').value.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

function addBubble(text, kind = 'bot', sources = []) {
  const bubble = document.createElement('article');
  bubble.className = kind;
  bubble.textContent = text;

  if (sources.length) {
    const sourceList = document.createElement('div');
    sourceList.className = 'sources';
    sourceList.textContent = `Sources: ${sources.slice(0, 8)
      .map((source) => source.type === 'pdf' ? `PDF page ${source.page}` : source.url)
      .join(' | ')}`;
    bubble.appendChild(sourceList);
  }

  $('messages').appendChild(bubble);
  $('messages').scrollTop = $('messages').scrollHeight;
  return bubble;
}

async function checkServer() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error('Health check failed');
    const data = await response.json();
    $('status').textContent = data.configured ? '● Connected' : '⚠ Configure API keys';
  } catch {
    $('status').textContent = '● Server offline';
  }
}

function setImage(file) {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!file) return;

  if (!allowedTypes.includes(file.type) || file.size > 5e6) {
    alert('Use a PNG, JPEG, or WebP image smaller than 5 MB.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    imageData = reader.result;
    $('thumbnail').src = imageData;
    $('preview').hidden = false;
  };
  reader.readAsDataURL(file);
}

function clearImage() {
  imageData = null;
  $('thumbnail').removeAttribute('src');
  $('preview').hidden = true;
  $('image').value = '';
}

$('image').addEventListener('change', (event) => setImage(event.target.files[0]));
$('remove').addEventListener('click', clearImage);

$('chatForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = $('message').value.trim();
  if (!message) return;

  const priorHistory = history.slice(-8);
  addBubble(message, 'user');
  $('message').value = '';
  $('send').disabled = true;
  const pending = addBubble('Thinking…');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        history: priorHistory,
        image_data: imageData,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || 'Request failed');

    pending.textContent = data.answer;
    lastAnswer = data.answer;

    if (data.sources?.length) {
      const sourceList = document.createElement('div');
      sourceList.className = 'sources';
      sourceList.textContent = `Sources: ${data.sources.slice(0, 8)
        .map((source) => source.type === 'pdf' ? `PDF page ${source.page}` : source.url)
        .join(' | ')}`;
      pending.appendChild(sourceList);
    }

    history.push(
      { role: 'user', content: message },
      { role: 'assistant', content: data.answer },
    );
    clearImage();
  } catch (error) {
    pending.textContent = `Error: ${error.message}`;
  } finally {
    $('send').disabled = false;
    $('messages').scrollTop = $('messages').scrollHeight;
  }
});

$('mic').addEventListener('click', async () => {
  if (recorder?.state === 'recording') {
    recorder.stop();
    $('mic').textContent = '🎤 Voice';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => audioChunks.push(event.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(audioChunks, { type: recorder.mimeType });
      const formData = new FormData();
      formData.append('file', blob, 'voice.webm');
      $('mic').disabled = true;

      try {
        const response = await fetch('/api/transcribe', {
          method: 'POST',
          headers: headers(),
          body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || 'Transcription failed');
        $('message').value = data.text;
      } catch (error) {
        alert(error.message);
      } finally {
        $('mic').disabled = false;
      }
    };
    recorder.start();
    $('mic').textContent = '⏹ Stop recording';
  } catch (error) {
    alert(`Microphone unavailable: ${error.message}`);
  }
});

$('listen').addEventListener('click', async () => {
  if (!lastAnswer) {
    alert('Ask a question first.');
    return;
  }

  $('listen').disabled = true;
  try {
    const response = await fetch('/api/speak', {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lastAnswer }),
    });
    if (!response.ok) throw new Error('Speech is unavailable.');

    const url = URL.createObjectURL(await response.blob());
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch (error) {
    alert(error.message);
  } finally {
    $('listen').disabled = false;
  }
});

$('camera').addEventListener('click', async () => {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    $('video').srcObject = cameraStream;
    $('video').hidden = false;
    $('cameraActions').hidden = false;
  } catch (error) {
    alert(`Camera unavailable: ${error.message}`);
  }
});

$('closeCamera').addEventListener('click', () => {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  $('video').srcObject = null;
  $('video').hidden = true;
  $('cameraActions').hidden = true;
});

$('snap').addEventListener('click', () => {
  const video = $('video');
  const canvas = $('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(
    (blob) => setImage(new File([blob], 'camera.jpg', { type: 'image/jpeg' })),
    'image/jpeg',
    0.85,
  );
  $('closeCamera').click();
});

checkServer();
