const socket = io('/');
const peer = new Peer(); // Utiliza o servidor público do PeerJS para facilitar a conexão
const videoGrid = document.getElementById('video-grid');
const shareBtn = document.getElementById('shareBtn');
const audioBtn = document.getElementById('audioBtn');
const linkBtn = document.getElementById('linkBtn');

const ROOM_ID = window.location.pathname.substring(1);
const peers = {}; // Guarda as conexões ativas
let localStream = null;

// Quando nossa conexão P2P abrir, entramos na sala pelo servidor
peer.on('open', id => {
    socket.emit('join-room', ROOM_ID, id);
});

// Quando um novo amigo entra na sala
socket.on('user-connected', userId => {
    // Se você já estiver transmitindo a tela, faça a ligação enviando o seu vídeo
    if (localStream) {
        connectToNewUser(userId, localStream);
    }
});

// Quando um amigo desconecta ou sai da página
socket.on('user-disconnected', userId => {
    if (peers[userId]) {
        peers[userId].close();
        delete peers[userId];
    }
    const videoEl = document.getElementById(`video-${userId}`);
    if (videoEl) videoEl.remove();
});

// Quando recebemos uma chamada P2P de alguém
peer.on('call', call => {
    // Atende a ligação (sem enviar stream de volta, pois somos espectadores)
    call.answer(); 
    
    const video = document.createElement('video');
    video.id = `video-${call.peer}`;

    // Quando recebermos a transmissão de tela do amigo
    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream);
    });

    call.on('close', () => {
        video.remove();
    });
    
    peers[call.peer] = call;
});

// Faz uma ligação enviando nossa transmissão de tela
function connectToNewUser(userId, stream) {
    const call = peer.call(userId, stream);
    const video = document.createElement('video');
    video.id = `video-${userId}`;

    call.on('stream', userVideoStream => {
        addVideoStream(video, userVideoStream);
    });

    call.on('close', () => {
        video.remove();
    });

    peers[userId] = call;
}

// Quando solicitamos a lista de quem já está na sala para compartilhar a tela com eles
socket.on('peers-list', peerIds => {
    peerIds.forEach(id => {
        connectToNewUser(id, localStream);
    });
});

// Botão de Compartilhar Tela
shareBtn.addEventListener('click', async () => {
    if (localStream) return; // Já está transmitindo

    try {
        // Pede acesso à tela e ao áudio do sistema/aba
        localStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true 
        });

        // Mostra o próprio vídeo para si mesmo (mutado para evitar eco)
        const myVideo = document.createElement('video');
        myVideo.muted = true; 
        myVideo.id = `video-${peer.id}`;
        addVideoStream(myVideo, localStream);

        // Ativa o botão de mute se a transmissão tiver áudio selecionado
        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            audioBtn.disabled = false;
            audioBtn.classList.remove('disabled');
        }

        // Solicita ao servidor a lista de todos os amigos já conectados na sala
        socket.emit('get-peers');

        // Se o usuário clicar em "Parar de Compartilhar" nas opções nativas do navegador
        localStream.getVideoTracks()[0].onended = () => {
            stopSharing();
        };

        shareBtn.innerText = "Transmissão Ativa";
        shareBtn.disabled = true;

    } catch (error) {
        console.error("Erro ao acessar a tela:", error);
    }
});

// Botão de ativar/desativar áudio da janela
audioBtn.addEventListener('click', () => {
    if (!localStream) return;
    
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        // Inverte o estado da faixa de áudio
        audioTrack.enabled = !audioTrack.enabled;
        
        // Atualiza a interface do botão
        if (audioTrack.enabled) {
            audioBtn.innerText = "Desativar Som da Transmissão";
            audioBtn.classList.remove('btn-danger');
        } else {
            audioBtn.innerText = "Ativar Som da Transmissão";
            audioBtn.classList.add('btn-danger');
        }
    }
});

// Botão de Copiar Link
linkBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.href);
    linkBtn.innerText = "Copiado!";
    setTimeout(() => linkBtn.innerText = "Copiar Link da Sala", 2000);
});

// Função para encerrar a transmissão
function stopSharing() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    
    // Reseta botões
    audioBtn.disabled = true;
    audioBtn.classList.add('disabled');
    audioBtn.classList.remove('btn-danger');
    audioBtn.innerText = "Desativar Som da Transmissão";
    shareBtn.disabled = false;
    shareBtn.innerText = "Transmitir Tela";
    
    const myVid = document.getElementById(`video-${peer.id}`);
    if (myVid) myVid.remove();
    
    // Desconecta e limpa as chamadas de quem estava assistindo
    for (let userId in peers) {
        peers[userId].close();
        delete peers[userId];
    }
}

// Anexa o elemento <video> no HTML
function addVideoStream(video, stream) {
    if (!document.getElementById(video.id)) {
        video.srcObject = stream;
        video.addEventListener('loadedmetadata', () => {
            video.play();
        });
        videoGrid.append(video);
    }
}