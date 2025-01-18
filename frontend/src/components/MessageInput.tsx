import { useState, useEffect, useRef } from 'react';
import { socket } from '../config/socket';
import Image from 'next/image';
import { FaPaperclip, FaMicrophone } from 'react-icons/fa';

interface User {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  isSystemUser?: boolean;
}

interface MessageInputProps {
  onSendMessage: (content: string, userId: string, username: string, fileAttachment?: {
    fileName: string;
    fileType: string;
    fileSize: number;
    fileUrl: string;
    s3Key: string;
  }) => void;
  currentUser: {
    uid: string;
    displayName?: string | null;
    email: string | null;
  };
}

export const MessageInput = ({ onSendMessage, currentUser }: MessageInputProps) => {
  const [inputValue, setInputValue] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionableUsers, setMentionableUsers] = useState<User[]>([]);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedUserIndex, setSelectedUserIndex] = useState(0);
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);

  useEffect(() => {
    const handleMentionableUsers = (users: User[]) => {
      setMentionableUsers(users);
    };

    socket.on('mentionable_users', handleMentionableUsers);

    return () => {
      socket.off('mentionable_users', handleMentionableUsers);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const selectionStart = e.target.selectionStart || 0;
    setInputValue(value);
    setCursorPosition(selectionStart);

    // Check if we should show mentions
    const lastAtSymbol = value.lastIndexOf('@', selectionStart);
    if (lastAtSymbol !== -1) {
      const textAfterAt = value.slice(lastAtSymbol + 1, selectionStart);
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt.toLowerCase());
        socket.emit('get_mentionable_users');
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  };

  const handleMentionSelect = (user: User) => {
    const lastAtSymbol = inputValue.lastIndexOf('@', cursorPosition);
    if (lastAtSymbol !== -1) {
      const displayName = user.displayName || user.email;
      const newValue = 
        inputValue.slice(0, lastAtSymbol) + 
        `@${displayName} ` + 
        inputValue.slice(cursorPosition);
      
      setInputValue(newValue);
      setShowMentions(false);
      
      // Focus back on input and place cursor after mention
      if (inputRef.current) {
        inputRef.current.focus();
        const newCursorPos = lastAtSymbol + displayName.length + 2; // +2 for @ and space
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showMentions && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedUserIndex((prev) => (prev + 1) % filteredUsers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedUserIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === 'Enter' && showMentions) {
        e.preventDefault();
        handleMentionSelect(filteredUsers[selectedUserIndex]);
        return;
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    }

    if (e.key === 'Enter' && inputValue.trim() && !showMentions) {
      onSendMessage(
        inputValue,
        currentUser.uid,
        currentUser.displayName || 'Anonymous'
      );
      setInputValue('');
      setShowMentions(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (100MB limit)
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_FILE_SIZE) {
      alert('File size exceeds maximum limit of 100MB');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsUploading(true);
    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Upload directly to backend
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      const uploadData = await response.json();

      // Send message with file attachment
      onSendMessage(
        `Shared a file: ${file.name}`,
        currentUser.uid,
        currentUser.displayName || 'Anonymous',
        {
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileUrl: uploadData.fileUrl,
          s3Key: uploadData.key
        }
      );
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(`Failed to upload file: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const filteredUsers = mentionableUsers.filter(user => {
    const searchText = user.displayName || user.email || '';
    return searchText.toLowerCase().includes(mentionSearch);
  });

  const initializeWebRTC = async () => {
    try {
      console.log('Initializing WebRTC...');
      
      // Get ephemeral key from server
      console.log('Fetching session token...');
      const tokenResponse = await fetch('/webrtc/session');
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Session request failed: ${tokenResponse.status} - ${errorText}`);
      }
      const data = await tokenResponse.json();
      console.log('Session token received');
      const EPHEMERAL_KEY = data.client_secret.value;

      // Create peer connection
      console.log('Creating RTCPeerConnection...');
      const pc = new RTCPeerConnection();
      setPeerConnection(pc);

      // Set up to play remote audio from the model
      console.log('Setting up audio playback...');
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      document.body.appendChild(audioEl);
      pc.ontrack = e => audioEl.srcObject = e.streams[0];

      // Add local audio track for microphone input
      console.log('Requesting microphone access...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');
      pc.addTrack(stream.getTracks()[0], stream);

      // Set up data channel
      console.log('Creating data channel...');
      const dc = pc.createDataChannel('oai-events');
      setDataChannel(dc);
      
      // Set up data channel event handlers
      dc.onopen = () => {
        console.log('Data channel opened');
        // Send initial greeting once the channel is open
        const greeting = {
          type: 'response.create',
          response: {
            modalities: ['text'],
            instructions: 'Hi there! How can I help you today?',
          },
        };
        dc.send(JSON.stringify(greeting));
      };
      
      dc.onclose = () => console.log('Data channel closed');
      dc.onerror = (error) => console.error('Data channel error:', error);
      
      dc.addEventListener('message', (e) => {
        console.log('Received message:', e.data);
        const realtimeEvent = JSON.parse(e.data);
        
        // Handle the event
        if (realtimeEvent.type === 'response.create') {
          const { text } = realtimeEvent.response;
          if (text) {
            onSendMessage(text, 'ai', 'AI Assistant');
          }
        }
      });

      // Start the session using SDP
      console.log('Creating offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Use the appropriate base URL based on environment
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://api.openai.com/v1/realtime'
        : 'https://api.openai.com/v1/realtime';
      const model = 'gpt-4o-realtime-preview-2024-12-17';
      console.log('Sending SDP to OpenAI...');
      const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${EPHEMERAL_KEY}`,
          'Content-Type': 'application/sdp'
        },
      });

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`SDP request failed: ${sdpResponse.status} - ${errorText}`);
      }

      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: await sdpResponse.text(),
      };
      console.log('Setting remote description...');
      await pc.setRemoteDescription(answer);

      console.log('WebRTC initialization complete');
      setIsVoiceChatActive(true);
    } catch (error: unknown) {
      console.error('Detailed WebRTC initialization error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to initialize voice chat: ${errorMessage}`);
      setIsVoiceChatActive(false);
    }
  };

  const handleVoiceChatToggle = async () => {
    if (!isVoiceChatActive) {
      await initializeWebRTC();
    } else {
      // Clean up WebRTC connection
      if (peerConnection) {
        peerConnection.close();
        setPeerConnection(null);
      }
      if (dataChannel) {
        dataChannel.close();
        setDataChannel(null);
      }
      setIsVoiceChatActive(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Use @ to mention)"
          className="flex-1 px-4 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isUploading}
        />
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
          disabled={isUploading}
          title="Attach file"
        >
          <FaPaperclip className={isUploading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={handleVoiceChatToggle}
          className={`px-4 py-2 ${
            isVoiceChatActive ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
          } text-white rounded-md transition-colors`}
          title={isVoiceChatActive ? 'Stop voice chat' : 'Start voice chat'}
        >
          <FaMicrophone className={isVoiceChatActive ? 'animate-pulse' : ''} />
        </button>
        <button
          onClick={() => {
            if (inputValue.trim()) {
              onSendMessage(
                inputValue,
                currentUser.uid,
                currentUser.displayName || 'Anonymous'
              );
              setInputValue('');
              setShowMentions(false);
            }
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-blue-300"
          disabled={isUploading}
        >
          Send
        </button>
      </div>

      {/* Mentions Popup */}
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute bottom-full mb-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 max-h-48 overflow-y-auto">
          {filteredUsers.map((user, index) => (
            <div
              key={user.userId}
              onClick={() => handleMentionSelect(user)}
              className={`px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2 ${
                index === selectedUserIndex ? 'bg-gray-100' : ''
              }`}
            >
              {user.photoURL && (
                <Image 
                  src={user.photoURL} 
                  alt="" 
                  width={24} 
                  height={24} 
                  className="rounded-full" 
                />
              )}
              <span className={user.isSystemUser ? 'text-blue-600 font-medium' : ''}>
                {user.displayName || user.email}
              </span>
              {user.isSystemUser && (
                <span className="text-xs text-gray-500">(AI Assistant)</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 