import { useState, useCallback, useEffect } from '@lynx-js/react';
import ImagePicker from './ImagePickerModule.js';
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
      body: JSON.stringify({ content, sender, imageData }) // Changed from imageUrl
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
  }
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
    <view style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#f0f0f0',
      padding: '20px'
    }}>
      <view style={{
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        padding: '24px',
        marginTop: '100px'
      }}>
        <text style={{
          fontSize: '24px',
          fontWeight: 'bold',
          color: '#333333',
          marginBottom: '20px',
          textAlign: 'center'
        }}>
          Welcome to Lynx Chat
        </text>

        <text style={{
          fontSize: '16px',
          color: '#666666',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          Choose your username
        </text>

        {error && (
          <text style={{
            fontSize: '14px',
            color: '#ff3333',
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            {error}
          </text>
        )}

        <view style={{ marginBottom: '20px' }}>
          <input
            value={username}
            placeholder="Enter username"
            bindinput={(e: { detail: { value: string } }) => setUsername(e.detail.value)}
            style={{
              width: '100%',
              height: '48px',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '16px',
              backgroundColor: '#ffffff'
            }}
          />
        </view>

        <view
          style={{
            width: '100%',
            height: '48px',
            backgroundColor: (username.trim().length >= 3 && !loading) ? '#007AFF' : '#cccccc',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
          bindtap={(username.trim().length >= 3 && !loading) ? handleSave : undefined}
        >
          <text style={{
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 'bold'
          }}>
            {loading ? 'Creating...' : 'Continue'}
          </text>
        </view>
      </view>
    </view>
  );
};

// Chat List Page (FIXED)
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
    // --- FIX 1: Make the root view a flex container ---
    <view style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#f0f0f0',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header (No changes needed here) */}
      <view style={{
        height: '100px',
        backgroundColor: '#007AFF',
        padding: '20px',
        paddingTop: '40px'
      }}>
        <view style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <view>
            <text style={{ color: '#ffffff', fontSize: '24px', fontWeight: 'bold' }}>
              Chats
            </text>
            <text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
              @{currentUser}
            </text>
          </view>

          <view
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            bindtap={onSearchUsers}
          >
            <text style={{ color: '#ffffff', fontSize: '20px' }}>+</text>
          </view>
        </view>
      </view>

      {/* --- FIX 2: Use a <scroll-view> that fills available space --- */}
      <view style={{ flex: 1, padding: '10px' }}>
        {chats.length === 0 ? (
          <view style={{
            padding: '60px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px'
          }}>
            <view style={{
              width: '80px',
              height: '80px',
              borderRadius: '40px',
              backgroundColor: '#e0e0e0',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <text style={{ fontSize: '32px' }}>💬</text>
            </view>
            <text style={{ fontSize: '18px', color: '#666666', textAlign: 'center' }}>
              No conversations yet
            </text>
            <text style={{ fontSize: '14px', color: '#999999', textAlign: 'center' }}>
              Tap + to search for users
            </text>
          </view>
        ) : (
          // --- FIX 3: Replace <list> and <list-item> with <scroll-view> and <view> ---
          <scroll-view style={{ width: '100%', height: '100%' }} scroll-orientation="vertical">
            {chats.map((chat) => (
              <view
                key={chat.id} // Key is now on the main <view>
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '8px',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: '12px'
                }}
                bindtap={() => onOpenChat(chat.id)}
              >
                <view style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '24px',
                  backgroundColor: '#007AFF',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center'
                }}>
                  <text style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold' }}>
                    {chat.username.charAt(0).toUpperCase()}
                  </text>
                </view>

                <view style={{ flex: 1 }}>
                  <view style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <text style={{ fontSize: '16px', fontWeight: 'bold', color: '#333333' }}>
                      @{chat.username}
                    </text>
                    <text style={{ fontSize: '12px', color: '#999999' }}>
                      {formatTime(chat.timestamp)}
                    </text>
                  </view>
                  <text style={{ fontSize: '14px', color: '#666666', marginTop: '4px' }}>
                    {chat.lastMessage || 'Start a conversation'}
                  </text>
                </view>

                {chat.unreadCount > 0 && (
                  <view style={{
                    minWidth: '20px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: '#ff3333',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingLeft: '6px',
                    paddingRight: '6px'
                  }}>
                    <text style={{ color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}>
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

  // This function is now the source of truth for handling searches.
  const handleSearch = useCallback(async (query: string) => {
    setLoading(true);
    setError('');
    try {
      // Use the provided query string.
      const response = await api.searchUsers(query, currentUser);

      // The API response is { "users": [...] }, so we access the .users property.
      if (response && Array.isArray(response.users)) {
        setResults(response.users);
      } else {
        // Handle cases where the response is not what we expect.
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

  // Load all users when the component first mounts.
  useEffect(() => {
    handleSearch(''); // An empty query fetches all users.
  }, [handleSearch]);

  return (
    <view style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#f0f0f0',
      display: 'flex', // Use flexbox for layout
      flexDirection: 'column'
    }}>
      {/* Header */}
      <view style={{
        height: '100px',
        backgroundColor: '#007AFF',
        padding: '20px',
        paddingTop: '40px'
      }}>
        <view style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '16px'
        }}>
          <view
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            bindtap={onBack}
          >
            <text style={{ color: '#ffffff', fontSize: '18px' }}>←</text>
          </view>
          <text style={{
            color: '#ffffff',
            fontSize: '20px',
            fontWeight: 'bold'
          }}>
            Search Users
          </text>
        </view>
      </view>

      {/* Search Input */}
      <view style={{ padding: '16px' }}>
        <view style={{
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '8px',
          gap: '8px'
        }}>
          <input
            value={searchQuery}
            placeholder="Search users..."
            bindinput={(e: { detail: { value: string } }) => setSearchQuery(e.detail.value)}
            style={{
              flex: 1,
              height: '40px',
              border: 'none',
              outline: 'none',
              fontSize: '16px',
              paddingLeft: '16px'
            }}
          />
          <view
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: loading ? '#cccccc' : '#007AFF',
              borderRadius: '20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
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
        <view style={{ padding: '0 16px' }}>
          <text style={{ fontSize: '14px', color: '#ff3333', textAlign: 'center' }}>
            {error}
          </text>
        </view>
      )}

      {/* --- RENDER RESULTS USING SCROLL-VIEW (THE FIX) --- */}
      <scroll-view
        style={{ flex: 1, padding: '0 16px' }}
        scroll-orientation="vertical"
      >
        {/* Show a message if loading is done and there are no results */}
        {!loading && results.length === 0 && (
          <text style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>
            No users found.
          </text>
        )}

        {results.map((user) => (
          <view
            key={user.username}
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '8px',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: '12px'
            }}
            bindtap={() => onAddChat(user.username)}
          >
            <view style={{
              width: '48px',
              height: '48px',
              borderRadius: '24px',
              backgroundColor: '#007AFF',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <text style={{
                color: '#ffffff',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                {user.username.charAt(0).toUpperCase()}
              </text>
            </view>
            <text style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: '#333333',
              flex: 1
            }}>
              @{user.username}
            </text>
            <text style={{ fontSize: '20px', color: '#007AFF' }}>+</text>
          </view>
        ))}
      </scroll-view>
    </view>
  );
};

// Chat Page
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
  const [lastTimestamp, setLastTimestamp] = useState<number>(() =>
    chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].timestamp : Date.now()
  );

  // --- FIX #1: This hook synchronizes the local state with the prop from the parent ---
  // This ensures that updates from the parent App component are reflected here.
  useEffect(() => {
    setMessages(chat.messages);
  }, [chat.messages]);


  // Real-time message polling (This part is correct)
  useEffect(() => {
    const pollMessages = async () => {
      try {
        // We use the local lastTimestamp state for polling
        const response = await api.getMessagesSince(chat.id, lastTimestamp);
        if (response.messages && response.messages.length > 0) {
          const newMessages: Message[] = response.messages.map((msg: any) => ({
            ...msg,
            type: msg.username === currentUser ? 'user' : 'other'
          }));

          setMessages(prevMessages => {
            const existingMessageIds = new Set(prevMessages.map((m: Message) => m.id));
            const trulyNewMessages = newMessages.filter((m: Message) => !existingMessageIds.has(m.id));

            if (trulyNewMessages.length === 0) {
              return prevMessages;
            }

            const updatedMessages = [...prevMessages, ...trulyNewMessages];
            // Also update the parent's state
            onUpdateChat(chat.id, updatedMessages);
            return updatedMessages;
          });

          setLastTimestamp(response.messages[response.messages.length - 1].timestamp);
        }
      } catch (err) {
        console.error('Polling failed:', err);
      }
    };

    const interval = setInterval(pollMessages, 1500);
    return () => clearInterval(interval);
  }, [chat.id, currentUser, lastTimestamp, onUpdateChat]);

  // handleSend logic is correct
  const handleSend = useCallback(async (content: string, imageData?: string) => {
    if (loading) return;

    setLoading(true);
    if (content) setInputContent('');

    try {
      // Pass the imageData (base64 or URI) to the API
      const response = await api.sendMessage(chat.id, content, currentUser, imageData);
      const newMessage: Message = { ...response.message, type: 'user' as const };

      setMessages(prevMessages => {
        const updatedMessages = [...prevMessages, newMessage];
        onUpdateChat(chat.id, updatedMessages);
        return updatedMessages;
      });

      setLastTimestamp(newMessage.timestamp);

    } catch (err: any) {
      console.error('Failed to send message:', err);
      if (content) setInputContent(content);
    } finally {
      setLoading(false);
    }
  }, [loading, currentUser, chat.id, onUpdateChat]);


  /**
   * This function is called when the user taps the send button for text.
   * It's a simple, parameter-less function suitable for UI event handlers.
   */
  const handleTextSend = () => {
    const content = inputContent.trim();
    if (content) {
      handleSend(content, undefined);
    }
  };

  /**
   * This function is called when the user taps the image button.
   */
  const handleImageSend = async () => {
    if (loading) return;

    try {
      // This will call either the REAL native module or your MOCK
      const response = await ImagePicker.pickImage();

      if (response.error) {
        // Handle cases where the user cancels or an error occurs
        console.error('Image picking failed:', response.error);
        return;
      }

      // We will use the image URI for display and upload.
      // The backend will need to handle receiving a URL or base64 data.
      if (response.uri || response.base64) {
        // Let's assume the backend can now accept a base64 string.
        // If you upload the file directly, the logic would be different.
        const imageToSend = response.base64 
          ? `data:image/jpeg;base64,${response.base64}` 
          : response.uri;
        
        // The handleSend function will be updated to send this data
        handleSend('', imageToSend);
      }

    } catch (err) {
      console.error('An error occurred while picking the image:', err);
    }
  };

  return (
    <view style={{
      width: '100%',
      height: '100%',
      backgroundColor: '#f0f0f0'
    }}>
      {/* Header */}
      <view style={{
        height: '100px',
        backgroundColor: '#007AFF',
        padding: '20px',
        paddingTop: '40px'
      }}>
        <view style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '16px'
        }}>
          <view
            style={{
              width: '40px',
              height: '40px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '20px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
            bindtap={onBack}
          >
            <text style={{ color: '#ffffff', fontSize: '18px' }}>←</text>
          </view>

          <view style={{ flex: 1 }}>
            <text style={{
              color: '#ffffff',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              @{chat.username}
            </text>
            <text style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '12px'
            }}>
              Online
            </text>
          </view>
        </view>
      </view>

      {/* Messages */}
      <view style={{ flex: 1, padding: '8px' }}>
        <list style={{
          width: '100%',
          height: '100%',
          paddingBottom: '100px'
        }}>
          {messages.map((message) => (
            <list-item key={message.id} item-key={message.id}>
              <view style={{
                padding: '4px 8px',
                display: 'flex',
                flexDirection: 'row',
                justifyContent: message.username === currentUser ? 'flex-end' : 'flex-start'
              }}>
                <view style={{
                  maxWidth: '75%',
                  backgroundColor: message.username === currentUser ? '#007AFF' : '#ffffff',
                  borderRadius: '16px',
                  padding: message.imageUrl ? '4px' : '12px 16px',
                  border: message.username === currentUser ? 'none' : '1px solid #e0e0e0'
                }}>
                  {message.imageUrl ? (
                    <image
                      src={message.imageUrl}
                      style={{
                        width: '200px',
                        height: '150px',
                        borderRadius: '12px'
                      }}
                    />
                  ) : (
                    <text style={{
                      color: message.username === currentUser ? '#ffffff' : '#333333',
                      fontSize: '15px'
                    }}>
                      {message.content}
                    </text>
                  )}
                </view>
              </view>
            </list-item>
          ))}
        </list>
      </view>

      {/* Input Bar */}
      <view style={{
        position: 'absolute',
        left: '0px',
        right: '0px',
        bottom: '20px',
        padding: '0 16px'
      }}>
        <view style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          padding: '8px',
          border: '1px solid #e0e0e0'
        }}>
          <view style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '8px'
          }}>
            {/* Image Button */}
            <view
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '18px',
                backgroundColor: loading ? '#cccccc' : '#f0f0f0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              bindtap={!loading ? handleImageSend : undefined}
            >
              <text style={{ fontSize: '16px' }}>📷</text>
            </view>

            <input
              value={inputContent}
              placeholder="Type a message..."
              bindinput={(e: { detail: { value: string } }) => setInputContent(e.detail.value)}
              style={{
                flex: 1,
                height: '40px',
                border: 'none',
                outline: 'none',
                fontSize: '15px',
                padding: '10px 12px'
              }}
            />

            {/* Send Button */}
            <view
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '18px',
                backgroundColor: (inputContent.trim() && !loading) ? '#007AFF' : '#f0f0f0',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
              bindtap={(inputContent.trim() && !loading) ? handleTextSend : undefined}
            >
              <text style={{
                color: (inputContent.trim() && !loading) ? '#ffffff' : '#999999',
                fontSize: '16px',
                fontWeight: 'bold'
              }}>
                {loading ? '⏳' : '↑'}
              </text>
            </view>
          </view>
        </view>
      </view>
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

  // Initialize on render
  useEffect(() => {
    console.log('Lynx Chat App initialized');
    props.onRender?.();

    // Check for existing user
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
      // Reload chats to get the new chat
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

  // Page routing
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