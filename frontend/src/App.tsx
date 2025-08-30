import { useState, useCallback, useEffect } from '@lynx-js/react';

// TypeScript interfaces
interface UserProfile {
  username: string;
  avatar?: string;
}

interface Message {
  id: string;
  content: string;
  type: 'user' | 'other';
  timestamp: number;
  imageUrl?: string;
  username: string;
}

interface Chat {
  id: string;
  username: string;
  avatar?: string;
  lastMessage?: string;
  messages: Message[];
  unreadCount: number;
  timestamp: number;
}


const SAMPLE_IMAGES = [
  'https://s3.ap-southeast-1.amazonaws.com/textract-public-assets-ap-southeast-1/DLRegular.png',
  'https://s3.ap-southeast-1.amazonaws.com/textract-public-assets-ap-southeast-1/Passport.png',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ38knCnD663lAFB8HFviaRm8F_FpzetB_gdQ&s',
  'https://www.shutterstock.com/image-photo/man-holds-credit-card-he-600nw-2476576361.jpg',
];

// API Configuration
const API_BASE_URL = 'http://192.168.0.253:8002';

// API Helper Functions
const api = {
  async registerUser(username: string) {
    const response = await lynx.fetch(`${API_BASE_URL}/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async searchUsers(query: string, currentUser: string) {
    const url = `${API_BASE_URL}/users/search?q=${encodeURIComponent(query)}&current_user=${encodeURIComponent(currentUser)}`;
    const response = await lynx.fetch(url);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Search failed');
    return data;
  },

  async getUserChats(username: string) {
    const response = await lynx.fetch(`${API_BASE_URL}/chats/${encodeURIComponent(username)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load chats');
    return data;
  },

  async createChat(user1: string, user2: string) {
    const response = await lynx.fetch(`${API_BASE_URL}/chats/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user1, user2 })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to create chat');
    return data;
  },

  async sendMessage(chatId: string, content: string, sender: string, imageData?: string) {
    const response = await lynx.fetch(`${API_BASE_URL}/chats/${chatId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        sender,
        imageUrl: imageData  // Changed from imageData to imageUrl
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to send message');
    return data;
  },

  async getMessages(chatId: string) {
    const response = await lynx.fetch(`${API_BASE_URL}/chats/${chatId}/messages`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load messages');
    return data;
  },

  async getMessagesSince(chatId: string, timestamp: number) {
    const response = await lynx.fetch(`${API_BASE_URL}/chats/${chatId}/messages/since/${timestamp}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to load new messages');
    return data;
  },

  async detectSensitiveData(imageUrl: string) {
    console.log('Detecting sensitive data for:', imageUrl);
    await new Promise(resolve => setTimeout(resolve, 800));

    // BBoxes are now relative [x1, y1, x2, y2] as percentages (0.0 to 1.0)
    const sensitiveDataMap: Record<string, number[][]> = {
      'https://s3.ap-southeast-1.amazonaws.com/textract-public-assets-ap-southeast-1/DLRegular.png': [
        [0.05, 0.15, 0.60, 0.30], // Relative bbox for name/address
        [0.05, 0.40, 0.75, 0.55]
      ],
      'https://www.shutterstock.com/image-photo/man-holds-credit-card-he-600nw-2476576361.jpg': [
        [0.35, 0.45, 0.85, 0.65] // Relative bbox for credit card numbers
      ],
    };

    const bboxes = sensitiveDataMap[imageUrl] || [];
    return {
      isSensitive: bboxes.length > 0,
      bboxes: bboxes,
    };
  },
};

// Simple in-memory storage for testing
let memoryStorage: Record<string, string> = {};

const Storage = {
  setItem: (key: string, value: any) => {
    memoryStorage[key] = JSON.stringify(value);
  },
  getItem: (key: string) => {
    try {
      return memoryStorage[key] ? JSON.parse(memoryStorage[key]) : null;
    } catch {
      return null;
    }
  }
};

// Username Setup Page
const UsernameSetupPage = ({ onComplete }: { onComplete: (username: string) => void }) => {
  const [username, setUsername] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSave = useCallback(async () => {
    const trimmed = username.trim();
    if (trimmed.length < 3) return;

    setLoading(true);
    setError('');

    try {
      await api.registerUser(trimmed);
      const userProfile: UserProfile = { username: trimmed };
      Storage.setItem('userProfile', userProfile);
      onComplete(trimmed);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }, [username, onComplete]);

  return (
    <view className="flex flex-col w-full h-full p-5" style={{ backgroundColor: '#f0f0f0' }}>
      <view className="flex-1 flex flex-col justify-center">
        <view className="bg-white rounded-xl p-6 mx-4" style={{ backgroundColor: '#ffffff' }}>
          <text className="text-2xl font-bold text-center mb-5" style={{ color: '#333333' }}>
            Welcome to Lynx Chat
          </text>

          <text className="text-base text-center mb-6" style={{ color: '#666666' }}>
            Choose your username
          </text>

          {error && (
            <text className="text-sm text-center mb-4" style={{ color: '#ff3333' }}>
              {error}
            </text>
          )}

          <view className="mb-5">
            <input
              value={username}
              placeholder="Enter username"
              bindinput={(e: { detail: { value: string } }) => setUsername(e.detail.value)}
              className="w-full h-12 border-2 rounded-lg px-3 text-base"
              style={{
                borderColor: '#e0e0e0',
                backgroundColor: '#ffffff'
              }}
            />
          </view>

          <view
            className="w-full h-12 rounded-lg flex justify-center items-center"
            style={{
              backgroundColor: (username.trim().length >= 3 && !loading) ? '#007AFF' : '#cccccc'
            }}
            bindtap={(username.trim().length >= 3 && !loading) ? handleSave : undefined}
          >
            <text className="text-base font-bold" style={{ color: '#ffffff' }}>
              {loading ? 'Creating...' : 'Continue'}
            </text>
          </view>
        </view>
      </view>
    </view>
  );
};

// Chat List Page
const ChatListPage = ({
  currentUser,
  onSearchUsers,
  chats,
  onOpenChat,
  onRefreshChats
}: {
  currentUser: string;
  onSearchUsers: () => void;
  chats: Chat[];
  onOpenChat: (chatId: string) => void;
  onRefreshChats: () => void;
}) => {
  const formatTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      onRefreshChats();
    }, 100);

    return () => clearInterval(interval);
  }, [onRefreshChats]);

  return (
    <view className="flex flex-col w-full h-full" style={{ backgroundColor: '#f0f0f0' }}>
      {/* Header */}
      <view className="h-25 px-5 pt-10 pb-5" style={{ backgroundColor: '#007AFF' }}>
        <view className="flex flex-row justify-between items-center">
          <view>
            <text className="text-2xl font-bold" style={{ color: '#ffffff' }}>
              Chats
            </text>
            <text className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
              @{currentUser}
            </text>
          </view>

          <view
            className="w-10 h-10 rounded-full flex justify-center items-center"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
            bindtap={onSearchUsers}
          >
            <text className="text-xl" style={{ color: '#ffffff' }}>+</text>
          </view>
        </view>
      </view>

      {/* Chat List */}
      <view className="flex-1 p-2">
        {chats.length === 0 ? (
          <view className="flex flex-col items-center py-16 px-5 gap-4">
            <view className="w-20 h-20 rounded-full bg-gray-200 flex justify-center items-center">
              <text className="text-3xl">💬</text>
            </view>
            <text className="text-lg text-center" style={{ color: '#666666' }}>
              No conversations yet
            </text>
            <text className="text-sm text-center" style={{ color: '#999999' }}>
              Tap + to search for users
            </text>
          </view>
        ) : (
          <scroll-view className="w-full h-full">
            {chats.map((chat) => (
              <view
                key={chat.id}
                className="bg-white rounded-xl p-4 mb-2 flex flex-row items-center gap-3"
                bindtap={() => onOpenChat(chat.id)}
              >
                <view className="w-12 h-12 rounded-full flex justify-center items-center" style={{ backgroundColor: '#007AFF' }}>
                  <text className="text-xl font-bold" style={{ color: '#ffffff' }}>
                    {chat.username.charAt(0).toUpperCase()}
                  </text>
                </view>

                <view className="flex-1">
                  <view className="flex flex-row justify-between items-center">
                    <text className="text-base font-bold" style={{ color: '#333333' }}>
                      @{chat.username}
                    </text>
                    <text className="text-xs" style={{ color: '#999999' }}>
                      {formatTime(chat.timestamp)}
                    </text>
                  </view>
                  <text className="text-sm mt-1" style={{ color: '#666666' }}>
                    {chat.lastMessage || 'Start a conversation'}
                  </text>
                </view>

                {chat.unreadCount > 0 && (
                  <view className="min-w-5 h-5 rounded-full px-2 flex justify-center items-center" style={{ backgroundColor: '#ff3333' }}>
                    <text className="text-xs font-bold" style={{ color: '#ffffff' }}>
                      {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                    </text>
                  </view>
                )}
              </view>
            ))}
          </scroll-view>
        )}
      </view>
    </view>
  );
};

// Search Page
const SearchPage = ({
  onBack,
  onAddChat,
  currentUser
}: {
  onBack: () => void;
  onAddChat: (username: string) => void;
  currentUser: string;
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleSearch = useCallback(async (query: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.searchUsers(query, currentUser);
      if (response && Array.isArray(response.users)) {
        setResults(response.users);
      } else {
        setError('Received invalid data from the server.');
        setResults([]);
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    handleSearch('');
  }, [handleSearch]);

  return (
    <view className="flex flex-col w-full h-full" style={{ backgroundColor: '#f0f0f0' }}>
      {/* Header */}
      <view className="h-25 px-5 pt-10 pb-5" style={{ backgroundColor: '#007AFF' }}>
        <view className="flex flex-row items-center gap-4">
          <view
            className="w-10 h-10 rounded-full flex justify-center items-center"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
            bindtap={onBack}
          >
            <text className="text-lg" style={{ color: '#ffffff' }}>←</text>
          </view>
          <text className="text-xl font-bold" style={{ color: '#ffffff' }}>
            Search Users
          </text>
        </view>
      </view>

      {/* Search Input */}
      <view className="p-4">
        <view className="flex flex-row bg-white rounded-full p-2 gap-2">
          <input
            value={searchQuery}
            placeholder="Search users..."
            bindinput={(e: { detail: { value: string } }) => setSearchQuery(e.detail.value)}
            className="flex-1 h-10 px-4 text-base border-none outline-none"
          />
          <view
            className="w-10 h-10 rounded-full flex justify-center items-center"
            style={{ backgroundColor: loading ? '#cccccc' : '#007AFF' }}
            bindtap={!loading ? () => handleSearch(searchQuery) : undefined}
          >
            <text style={{ color: '#ffffff' }}>
              {loading ? '⏳' : '🔍'}
            </text>
          </view>
        </view>
      </view>

      {/* Error Display */}
      {error && (
        <view className="px-4">
          <text className="text-sm text-center" style={{ color: '#ff3333' }}>
            {error}
          </text>
        </view>
      )}

      {/* Results */}
      <view className="flex-1 px-4">
        <scroll-view className="w-full h-full">
          {!loading && results.length === 0 && (
            <text className="text-center mt-5" style={{ color: '#666666' }}>
              No users found.
            </text>
          )}

          {results.map((user) => (
            <view
              key={user.username}
              className="bg-white rounded-xl p-4 mb-2 flex flex-row items-center gap-3"
              bindtap={() => onAddChat(user.username)}
            >
              <view className="w-12 h-12 rounded-full flex justify-center items-center" style={{ backgroundColor: '#007AFF' }}>
                <text className="text-lg font-bold" style={{ color: '#ffffff' }}>
                  {user.username.charAt(0).toUpperCase()}
                </text>
              </view>
              <text className="flex-1 text-base font-bold" style={{ color: '#333333' }}>
                @{user.username}
              </text>
              <text className="text-xl" style={{ color: '#007AFF' }}>+</text>
            </view>
          ))}
        </scroll-view>
      </view>
    </view>
  );
};

const ChatPage = ({
  chat,
  onBack,
  currentUser,
  onUpdateChat
}: {
  chat: Chat;
  onBack: () => void;
  currentUser: string;
  onUpdateChat: (chatId: string, messages: Message[]) => void;
}) => {
  const [inputContent, setInputContent] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>(chat.messages);
  const [loading, setLoading] = useState<boolean>(false);
  const [lastTimestamp, setLastTimestamp] = useState<number>(0);
  const [showImagePicker, setShowImagePicker] = useState<boolean>(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);

  // --- CHANGE 1: New state to manage the image confirmation flow ---
  const [pendingImage, setPendingImage] = useState<{
    url: string;
    bboxes: number[][];
    isSensitive: boolean;
  } | null>(null);


  // (useEffect hooks for syncing and polling remain the same)
  useEffect(() => {
    setMessages(chat.messages);
    setLastTimestamp(0);
  }, [chat.messages, chat.id]);

  useEffect(() => {
    let isActive = true;
    let pollCount = 0;
    const pollMessages = async () => {
      if (!isActive) return;
      try {
        const timestampToUse = pollCount < 3 ? 0 : lastTimestamp;
        const response = await api.getMessagesSince(chat.id, timestampToUse);
        if (!isActive) return;
        if (response.messages && response.messages.length > 0) {
          const newMessages: Message[] = response.messages.map((msg: any) => ({
            ...msg,
            type: msg.username === currentUser ? 'user' : 'other'
          }));
          setMessages(prev => {
            if (pollCount < 3) {
              onUpdateChat(chat.id, newMessages);
              return newMessages;
            } else {
              const existingIds = new Set(prev.map(m => m.id));
              const trulyNew = newMessages.filter(m => !existingIds.has(m.id));
              if (trulyNew.length === 0) return prev;
              const updated = [...prev, ...trulyNew];
              onUpdateChat(chat.id, updated);
              return updated;
            }
          });
          const latestTimestamp = Math.max(...response.messages.map((msg: any) => msg.timestamp));
          setLastTimestamp(latestTimestamp);
        }
        pollCount++;
      } catch (err) {
        console.error('Polling failed:', err);
      }
    };
    pollMessages();
    const interval = setInterval(pollMessages, 1000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [chat.id, currentUser, onUpdateChat]);


  const handleSend = useCallback(async (content: string, imageData?: string) => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await api.sendMessage(chat.id, content, currentUser, imageData);
      const newMessage: Message = { ...response.message, type: 'user' as const };
      setMessages(prev => {
        const updated = [...prev, newMessage];
        onUpdateChat(chat.id, updated);
        return updated;
      });
      setLastTimestamp(newMessage.timestamp);
    } catch (err: any) {
      console.error('Failed to send message:', err);
    } finally {
      setLoading(false);
    }
  }, [loading, currentUser, chat.id, onUpdateChat]);

  const handleTextSend = useCallback(() => {
    const content = inputContent.trim();
    if (content) {
      setInputContent('');
      handleSend(content, undefined);
    }
  }, [inputContent, handleSend]);

  // --- CHANGE 2: `handleImageSend` now triggers the detection and confirmation flow ---
  const handleImageSend = useCallback(async (imageUrl?: string) => {
    if (loading) return;

    if (imageUrl) {
      setShowImagePicker(false);
      setLoading(true);

      try {
        // Simulate API call to detect sensitive data
        const detectionResult = await api.detectSensitiveData(imageUrl);

        if (detectionResult.isSensitive) {
          // If sensitive, set pending state to show confirmation UI
          setPendingImage({
            url: imageUrl,
            bboxes: detectionResult.bboxes,
            isSensitive: true,
          });
        } else {
          // If not sensitive, send directly
          handleSend('', imageUrl);
        }
      } catch (error) {
        console.error("Detection failed:", error);
        // Fallback: send the image directly if detection fails
        handleSend('', imageUrl);
      } finally {
        setLoading(false);
      }
    } else {
      setShowImagePicker(true);
    }
  }, [loading, handleSend]);

  // --- CHANGE 3: New handlers for the confirmation prompt ---
  const handleConfirmSend = useCallback(() => {
    if (!pendingImage) return;
    // User chose "Yes", send the original image
    handleSend('', pendingImage.url);
    setPendingImage(null); // Clear pending state
  }, [pendingImage, handleSend]);

  const handleCancelSend = useCallback(() => {
    // User chose "No", just clear the state
    setPendingImage(null);
  }, []);


  // --- CHANGE 4: A new component to render the confirmation UI ---
  const ImageConfirmationPrompt = () => {
    if (!pendingImage) return null;

    // Assuming the preview image has a fixed size for bbox calculation
    const PREVIEW_WIDTH = 300;
    const PREVIEW_HEIGHT = 150;

    return (
      <view className="p-4 pt-2 flex-shrink-0 flex flex-col" style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e0e0e0' }}>
        <text className="text-sm font-bold text-center mb-2" style={{ color: '#333333' }}>
          Sensitive data detected. Send anyway?
        </text>
        <view className="relative rounded-lg overflow-hidden border border-gray-300 mx-auto" style={{ width: `${PREVIEW_WIDTH}px`, height: `${PREVIEW_HEIGHT}px` }}>
          <image
            src={pendingImage.url}
            className="w-full h-full object-fit"
          />

          {pendingImage.bboxes.map((bbox, index) => {
            const [x1, y1, x2, y2] = bbox;
            const width = x2 - x1;
            const height = y2 - y1;
            return (
              <view
                key={index}
                className="absolute rounded-md"
                style={{
                  left: `${x1}px`,
                  top: `${y1}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                  backgroundColor: 'rgba(255, 255, 255, 0.4)',
                  backdropFilter: 'blur(100px)', // This creates the blur effect
                }}
              />
            );
          })}
        </view>
        <view className="flex flex-row gap-3 mt-3">
          <view
            className="flex-1 h-10 rounded-full flex justify-center items-center"
            style={{ backgroundColor: '#28a745' }}
            bindtap={handleConfirmSend}
          >
            <text className="text-base font-bold" style={{ color: '#ffffff' }}>Yes, Send</text>
          </view>
          <view
            className="flex-1 h-10 rounded-full flex justify-center items-center"
            style={{ backgroundColor: '#dc3545' }}
            bindtap={handleCancelSend}
          >
            <text className="text-base font-bold" style={{ color: '#ffffff' }}>No, Cancel</text>
          </view>
        </view>
      </view>
    );
  };

  return (
    <view
      className="flex flex-col w-full h-full"
      style={{
        backgroundColor: '#f0f0f0',
        paddingBottom: isKeyboardVisible ? '270px' : '0px',
        transition: 'padding-bottom 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
      }}
    >
      {/* Header and Message List (no changes) */}
      <view className="h-25 px-5 pt-10 pb-5" style={{ backgroundColor: '#007AFF' }}>
        <view className="flex flex-row items-center gap-4">
          <view className="w-10 h-10 rounded-full flex justify-center items-center" style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }} bindtap={onBack}>
            <text className="text-lg" style={{ color: '#ffffff' }}>←</text>
          </view>
          <view className="flex-1">
            <text className="text-lg font-bold" style={{ color: '#ffffff' }}>@{chat.username}</text>
            <text className="text-xs" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>Online</text>
          </view>
        </view>
      </view>
      <list className="flex-1 w-full p-2">
        {messages.map((message) => (
          <list-item key={message.id} item-key={message.id}>
            <view className={`p-1 px-2 flex flex-row ${message.username === currentUser ? 'justify-end' : 'justify-start'}`}>
              <view className={`max-w-3/4 rounded-2xl ${message.username === currentUser ? 'border-none' : 'border border-gray-200'}`} style={{ backgroundColor: message.username === currentUser ? '#007AFF' : '#ffffff', padding: message.imageUrl ? '4px' : '14px 16px', minHeight: message.imageUrl ? 'auto' : '40px' }}>
                {message.imageUrl ? (
                  <image src={message.imageUrl} className="rounded-xl" style={{ width: '200px', height: '150px', objectFit: 'cover' }} auto-size={false} />
                ) : (
                  <text className="text-base" style={{ color: message.username === currentUser ? '#ffffff' : '#333333' }}>{message.content}</text>
                )}
              </view>
            </view>
          </list-item>
        ))}
      </list>

      {pendingImage ? <ImageConfirmationPrompt /> : (
        <view className="p-4 pb-6 flex-shrink-0 relative" style={{ backgroundColor: '#f0f0f0' }}>
          <view className="rounded-full p-2 border border-gray-200 flex flex-row items-center gap-2" style={{ backgroundColor: '#ffffff' }}>
            <view className="w-9 h-9 rounded-full flex justify-center items-center" style={{ backgroundColor: loading ? '#cccccc' : '#f0f0f0' }} bindtap={!loading ? () => handleImageSend() : undefined}>
              <text className="text-base">📷</text>
            </view>
            <input value={inputContent} placeholder="Type a message..." bindinput={(e: { detail: { value: string } }) => setInputContent(e.detail.value)} bindfocus={() => setIsKeyboardVisible(true)} bindblur={() => setIsKeyboardVisible(false)} className="flex-1 h-10 border-none outline-none text-base px-3 py-2" style={{ backgroundColor: 'transparent' }} />
            <view className="w-9 h-9 rounded-full flex justify-center items-center" style={{ backgroundColor: (inputContent.trim() && !loading) ? '#007AFF' : '#f0f0f0' }} bindtap={(inputContent.trim() && !loading) ? handleTextSend : undefined}>
              <text className="text-base font-bold" style={{ color: (inputContent.trim() && !loading) ? '#ffffff' : '#999999' }}>{loading ? '⏳' : '↑'}</text>
            </view>
          </view>
          {showImagePicker && (
            <view className="absolute left-4 right-4 rounded-xl p-4 border border-gray-200 max-h-75" style={{ backgroundColor: '#ffffff', bottom: '80px', zIndex: 1000 }}>
              <view className="flex flex-row justify-between items-center mb-4">
                <text className="text-base font-bold" style={{ color: '#333333' }}>Select Image</text>
                <view className="w-8 h-8 rounded-full flex justify-center items-center" style={{ backgroundColor: '#f0f0f0' }} bindtap={() => setShowImagePicker(false)}>
                  <text className="text-lg" style={{ color: '#666666' }}>×</text>
                </view>
              </view>
              <scroll-view className="h-50">
                <view className="flex flex-row flex-wrap gap-2">
                  {SAMPLE_IMAGES.map((imageUrl, index) => (
                    <view key={index} className="rounded-lg overflow-hidden border border-gray-200" style={{ width: 'calc(33.33% - 8px)', aspectRatio: '1' }} bindtap={() => handleImageSend(imageUrl)}>
                      <image src={imageUrl} className="w-full h-full object-cover" />
                    </view>
                  ))}
                </view>
              </scroll-view>
            </view>
          )}
        </view>
      )}
    </view>
  );
};

// Main App Component
export const App = (props: { onRender?: () => void }) => {
  const [currentPage, setCurrentPage] = useState<'setup' | 'chatList' | 'search' | 'chat'>('setup');
  const [currentUser, setCurrentUser] = useState<string>('');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    console.log('Lynx Chat App initialized');
    props.onRender?.();

    const savedProfile = Storage.getItem('userProfile');

    if (savedProfile?.username) {
      setCurrentUser(savedProfile.username);
      loadUserChats(savedProfile.username);
      setCurrentPage('chatList');
    }
  }, [props]);

  const loadUserChats = useCallback(async (username: string) => {
    setLoading(true);
    try {
      const response = await api.getUserChats(username);
      const chatsWithTypes = response.chats.map((chat: any) => ({
        ...chat,
        messages: chat.messages.map((msg: any) => ({
          ...msg,
          type: msg.username === username ? 'user' : 'other'
        }))
      }));
      setChats(chatsWithTypes);
    } catch (err) {
      console.error('Failed to load chats:', err);
      setChats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUsernameComplete = useCallback((username: string) => {
    setCurrentUser(username);
    loadUserChats(username);
    setCurrentPage('chatList');
  }, [loadUserChats]);

  const handleAddChat = useCallback(async (username: string) => {
    try {
      await api.createChat(currentUser, username);
      await loadUserChats(currentUser);
      setCurrentPage('chatList');
    } catch (err) {
      console.error('Failed to create chat:', err);
    }
  }, [currentUser, loadUserChats]);

  const handleOpenChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    setCurrentPage('chat');
  }, []);

  const handleUpdateChat = useCallback((chatId: string, newMessages: Message[]) => {
    setChats(prev => {
      const updated = prev.map(chat => {
        if (chat.id === chatId) {
          const lastMessage = newMessages[newMessages.length - 1];
          return {
            ...chat,
            messages: newMessages,
            lastMessage: lastMessage?.content || (lastMessage?.imageUrl ? '📷 Image' : ''),
            timestamp: lastMessage?.timestamp || chat.timestamp
          };
        }
        return chat;
      });
      return updated;
    });
  }, []);

  const handleRefreshChats = useCallback(() => {
    if (currentUser) {
      loadUserChats(currentUser);
    }
  }, [currentUser, loadUserChats]);

  const selectedChat = chats.find(chat => chat.id === selectedChatId);

  switch (currentPage) {
    case 'setup':
      return <UsernameSetupPage onComplete={handleUsernameComplete} />;

    case 'search':
      return (
        <SearchPage
          onBack={() => setCurrentPage('chatList')}
          onAddChat={handleAddChat}
          currentUser={currentUser}
        />
      );

    case 'chat':
      return selectedChat ? (
        <ChatPage
          chat={selectedChat}
          onBack={() => setCurrentPage('chatList')}
          currentUser={currentUser}
          onUpdateChat={handleUpdateChat}
        />
      ) : null;

    default:
      return (
        <ChatListPage
          currentUser={currentUser}
          onSearchUsers={() => setCurrentPage('search')}
          chats={chats}
          onOpenChat={handleOpenChat}
          onRefreshChats={handleRefreshChats}
        />
      );
  }
};