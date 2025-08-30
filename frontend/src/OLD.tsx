
// import { useState, useCallback, useEffect, useRef } from '@lynx-js/react';

// // TypeScript interfaces
// interface UserProfile {
//   username: string;
//   avatar?: string;
// }

// interface Message {
//   id: string;
//   content: string;
//   type: 'user' | 'other';
//   timestamp: number;
//   imageUrl?: string;
//   username: string;
// }

// interface Chat {
//   id: string;
//   username: string;
//   avatar?: string;
//   lastMessage?: string;
//   messages: Message[];
//   unreadCount: number;
//   timestamp: number;
// }

// // API Configuration
// const API_BASE_URL = 'http://192.168.0.253:8002';
// const WS_BASE_URL = 'ws://192.168.0.253:8002';

// // WebSocket Manager Class
// class WebSocketManager {
//   private ws: WebSocket | null = null;
//   private username: string = '';
//   private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();
//   private reconnectAttempts = 0;
//   private maxReconnectAttempts = 5;
//   private reconnectDelay = 1000;

//   connect(username: string): Promise<void> {
//     if (this.ws && this.ws.readyState === WebSocket.OPEN && this.username === username) {
//       return Promise.resolve();
//     }

//     return new Promise((resolve, reject) => {
//       this.username = username;
//       this.ws = new WebSocket(`${WS_BASE_URL}/ws/${username}`);

//       this.ws.onopen = () => {
//         console.log('WebSocket connected');
//         this.reconnectAttempts = 0;
//         resolve();
//       };

//       this.ws.onmessage = (event) => {
//         try {
//           const message = JSON.parse(event.data);
//           const handlers = this.messageHandlers.get(message.type);
//           if (handlers) {
//             handlers.forEach(handler => handler(message.data));
//           }
//         } catch (error) {
//           console.error('Error parsing WebSocket message:', error);
//         }
//       };

//       this.ws.onclose = (event) => {
//         console.log('WebSocket disconnected:', event.code, event.reason);
//         if (event.code !== 1000) {
//           this.attemptReconnect();
//         }
//       };

//       this.ws.onerror = (error) => {
//         console.error('WebSocket error:', error);
//         reject(error);
//       };
//     });
//   }

//   private attemptReconnect() {
//     if (this.reconnectAttempts < this.maxReconnectAttempts) {
//       this.reconnectAttempts++;
//       console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

//       setTimeout(() => {
//         this.connect(this.username).catch(() => {
//           // Reconnection failed, will try again if attempts remain
//         });
//       }, this.reconnectDelay * this.reconnectAttempts);
//     }
//   }

//   disconnect() {
//     if (this.ws) {
//       this.ws.close(1000);
//       this.ws = null;
//     }
//     this.messageHandlers.clear();
//   }

//   send(type: string, data: any = {}) {
//     if (this.ws && this.ws.readyState === WebSocket.OPEN) {
//       this.ws.send(JSON.stringify({ type, data }));
//     } else {
//       console.error('WebSocket not connected');
//     }
//   }

//   onMessage(type: string, handler: (data: any) => void) {
//     if (!this.messageHandlers.has(type)) {
//       this.messageHandlers.set(type, new Set());
//     }
//     this.messageHandlers.get(type)!.add(handler);
//   }

//   offMessage(type: string, handler: (data: any) => void) {
//     const handlers = this.messageHandlers.get(type);
//     if (handlers) {
//       handlers.delete(handler);
//       if (handlers.size === 0) {
//         this.messageHandlers.delete(type);
//       }
//     }
//   }
// }

// // Global WebSocket instance
// const wsManager = new WebSocketManager();

// // API helper functions
// const api = {
//   async registerUser(username: string) {
//     const response = await lynx.fetch(`${API_BASE_URL}/users/register`, {
//       method: 'POST',
//       headers: { 'Content-Type': 'application/json' },
//       body: JSON.stringify({ username })
//     });
//     const data = await response.json();
//     if (!response.ok) throw new Error(data.detail || 'Registration failed');
//     return data;
//   },

//   searchUsers(query: string): Promise<UserProfile[]> {
//     return new Promise((resolve, reject) => {
//       let handler: (data: any) => void;
//       const timeout = setTimeout(() => {
//         wsManager.offMessage('search_users_result', handler);
//         reject(new Error('Search timeout'));
//       }, 5000);

//       handler = (data) => {
//         clearTimeout(timeout);
//         wsManager.offMessage('search_users_result', handler);
//         resolve(data.users);
//       };
//       wsManager.onMessage('search_users_result', handler);
//       wsManager.send('search_users', { query });
//     });
//   },

//   getUserChats(): Promise<Chat[]> {
//     return new Promise((resolve, reject) => {
//       let handler: (data: any) => void;
//       const timeout = setTimeout(() => {
//         wsManager.offMessage('chats_updated', handler);
//         reject(new Error('Get chats timeout'));
//       }, 5000);

//       handler = (data) => {
//         clearTimeout(timeout);
//         wsManager.offMessage('chats_updated', handler);
//         resolve(data.chats);
//       };
//       wsManager.onMessage('chats_updated', handler);
//       wsManager.send('get_chats');
//     });
//   },

//   createChat(otherUser: string): Promise<string> {
//     return new Promise((resolve, reject) => {
//       let handler: (data: any) => void;
//       const timeout = setTimeout(() => {
//         wsManager.offMessage('chat_created', handler);
//         reject(new Error('Create chat timeout'));
//       }, 5000);

//       handler = (data) => {
//         clearTimeout(timeout);
//         wsManager.offMessage('chat_created', handler);
//         resolve(data.chat_id);
//       };
//       wsManager.onMessage('chat_created', handler);
//       wsManager.send('create_chat', { other_user: otherUser });
//     });
//   },

//   sendMessage(chatId: string, content: string, imageUrl?: string) {
//     wsManager.send('send_message', {
//       chat_id: chatId,
//       content,
//       image_url: imageUrl
//     });
//   },

//   getMessages(chatId: string): Promise<Message[]> {
//     return new Promise((resolve, reject) => {
//       let handler: (data: any) => void;
//       const timeout = setTimeout(() => {
//         wsManager.offMessage('messages_loaded', handler);
//         reject(new Error('Get messages timeout'));
//       }, 5000);

//       handler = (data) => {
//         if (data.chat_id === chatId) {
//           clearTimeout(timeout);
//           wsManager.offMessage('messages_loaded', handler);
//           resolve(data.messages);
//         }
//       };
//       wsManager.onMessage('messages_loaded', handler);
//       wsManager.send('get_messages', { chat_id: chatId });
//     });
//   },

//   joinChat(chatId: string) {
//     wsManager.send('join_chat', { chat_id: chatId });
//   }
// };

// // Simple in-memory storage for testing
// let memoryStorage: Record<string, string> = {};

// const Storage = {
//   setItem: (key: string, value: any) => {
//     memoryStorage[key] = JSON.stringify(value);
//   },
//   getItem: (key: string) => {
//     try {
//       return memoryStorage[key] ? JSON.parse(memoryStorage[key]) : null;
//     } catch {
//       return null;
//     }
//   }
// };

// // Username Setup Page
// const UsernameSetupPage = ({ onComplete }: { onComplete: (username: string) => void }) => {
//   const [username, setUsername] = useState<string>('');
//   const [loading, setLoading] = useState<boolean>(false);
//   const [error, setError] = useState<string>('');

//   const handleSave = useCallback(async () => {
//     const trimmed = username.trim();
//     if (trimmed.length < 3) return;
//     setLoading(true);
//     setError('');
//     try {
//       await api.registerUser(trimmed);
//       const userProfile: UserProfile = { username: trimmed };
//       Storage.setItem('userProfile', userProfile);
//       onComplete(trimmed);
//     } catch (err: any) {
//       setError(err.message || 'Registration failed');
//     } finally {
//       setLoading(false);
//     }
//   }, [username, onComplete]);

//   return (
//     <view style={{ 
//       width: '100%', 
//       height: '100vh',
//       backgroundColor: '#f0f0f0', 
//       padding: '20px',
//       display: 'flex',
//       flexDirection: 'column',
//       justifyContent: 'center',
//       alignItems: 'center'
//     }}>
//       <view style={{ 
//         backgroundColor: '#ffffff', 
//         borderRadius: '12px', 
//         padding: '24px',
//         width: '100%',
//         maxWidth: '400px'
//       }}>
//         <text style={{ 
//           fontSize: '24px', 
//           fontWeight: 'bold', 
//           color: '#333333', 
//           marginBottom: '20px', 
//           textAlign: 'center' 
//         }}>
//           Welcome to Lynx Chat
//         </text>
//         <text style={{ 
//           fontSize: '16px', 
//           color: '#666666', 
//           marginBottom: '24px', 
//           textAlign: 'center' 
//         }}>
//           Choose your username
//         </text>
//         {error && (
//           <text style={{ 
//             fontSize: '14px', 
//             color: '#ff3333', 
//             marginBottom: '16px', 
//             textAlign: 'center' 
//           }}>
//             {error}
//           </text>
//         )}
//         <view style={{ marginBottom: '20px' }}>
//           <input
//             value={username}
//             placeholder="Enter username"
//             bindinput={(e: { detail: { value: string } }) => setUsername(e.detail.value)}
//             style={{ 
//               width: '100%', 
//               height: '48px', 
//               border: '2px solid #e0e0e0', 
//               borderRadius: '8px', 
//               padding: '12px', 
//               fontSize: '16px', 
//               backgroundColor: '#ffffff' 
//             }}
//           />
//         </view>
//         <view
//           style={{ 
//             width: '100%', 
//             height: '48px', 
//             backgroundColor: (username.trim().length >= 3 && !loading) ? '#007AFF' : '#cccccc', 
//             borderRadius: '8px', 
//             display: 'flex', 
//             justifyContent: 'center', 
//             alignItems: 'center',
//             cursor: (username.trim().length >= 3 && !loading) ? 'pointer' : 'default'
//           }}
//           bindtap={(username.trim().length >= 3 && !loading) ? handleSave : undefined}
//         >
//           <text style={{ 
//             color: '#ffffff', 
//             fontSize: '16px', 
//             fontWeight: 'bold' 
//           }}>
//             {loading ? 'Creating...' : 'Continue'}
//           </text>
//         </view>
//       </view>
//     </view>
//   );
// };

// // Chat List Page - FINAL FIXED CODE
// const ChatListPage = ({ 
//   currentUser, 
//   onSearchUsers,
//   chats,
//   onOpenChat,
//   onChatsUpdate
// }: { 
//   currentUser: string;
//   onSearchUsers: () => void;
//   chats: Chat[];
//   onOpenChat: (chatId: string) => void;
//   onChatsUpdate: (update: Chat[] | ((prevChats: Chat[]) => Chat[])) => void;
// }) => {
//   const [wsConnected, setWsConnected] = useState<boolean>(true);

//   const formatTime = (timestamp: number): string => {
//     const now = Date.now();
//     const diff = now - timestamp;
//     const minutes = Math.floor(diff / 60000);
//     const hours = Math.floor(diff / 3600000);
//     const days = Math.floor(diff / 86400000);
    
//     if (minutes < 1) return 'now';
//     if (minutes < 60) return `${minutes}m`;
//     if (hours < 24) return `${hours}h`;
//     return `${days}d`;
//   };

//   // Setup WebSocket handlers for real-time updates
//   useEffect(() => {
//     const handleNewChat = (data: any) => {
//       const newChat: Chat = {
//         ...data,
//         messages: data.messages.map((msg: any) => ({
//           ...msg,
//           type: msg.username === currentUser ? 'user' : 'other'
//         }))
//       };
//       onChatsUpdate((prevChats: Chat[]) => [...prevChats, newChat]);
//     };

//     const handleNewMessage = (data: any) => {
//       onChatsUpdate((prevChats: Chat[]) => {
//         return prevChats.map((chat: Chat) => {
//           if (chat.id === data.chat_id) {
//             const newMessage: Message = {
//               ...data.message,
//               type: data.message.username === currentUser ? 'user' : 'other'
//             };
//             return {
//               ...chat,
//               messages: [...chat.messages, newMessage],
//               lastMessage: newMessage.content || (newMessage.imageUrl ? '📷 Image' : ''),
//               timestamp: newMessage.timestamp
//             };
//           }
//           return chat;
//         });
//       });
//     };

//     wsManager.onMessage('new_chat', handleNewChat);
//     wsManager.onMessage('new_message', handleNewMessage);

//     return () => {
//       wsManager.offMessage('new_chat', handleNewChat);
//       wsManager.offMessage('new_message', handleNewMessage);
//     };
//   }, [currentUser, onChatsUpdate]);

//   return (
//     <view style={{
//       width: '100%',
//       height: '100vh',
//       backgroundColor: '#f0f0f0',
//       display: 'flex',
//       flexDirection: 'column'
//     }}>
//       {/* Header */}
//       <view style={{
//         height: '100px',
//         backgroundColor: '#007AFF',
//         padding: '20px',
//         paddingTop: '40px'
//       }}>
//         <view style={{
//           display: 'flex',
//           flexDirection: 'row',
//           justifyContent: 'space-between',
//           alignItems: 'center'
//         }}>
//           <view>
//             <text style={{ color: '#ffffff', fontSize: '24px', fontWeight: 'bold' }}>
//               Chats
//             </text>
//             <view style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
//               <text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
//                 @{currentUser}
//               </text>
//               <view style={{
//                 width: '8px',
//                 height: '8px',
//                 borderRadius: '4px',
//                 backgroundColor: wsConnected ? '#00ff00' : '#ff4444'
//               }} />
//             </view>
//           </view>
          
//           <view
//             style={{
//               width: '40px',
//               height: '40px',
//               backgroundColor: 'rgba(255, 255, 255, 0.2)',
//               borderRadius: '20px',
//               display: 'flex',
//               justifyContent: 'center',
//               alignItems: 'center'
//             }}
//             bindtap={onSearchUsers}
//           >
//             <text style={{ color: '#ffffff', fontSize: '20px' }}>+</text>
//           </view>
//         </view>
//       </view>

//       {/* Chat List - FIXED: Using <list> with string item-key */}
//       <view style={{ flex: 1, padding: '10px' }}>
//         {chats.length === 0 ? (
//           <view style={{
//             padding: '60px 20px',
//             display: 'flex',
//             flexDirection: 'column',
//             alignItems: 'center',
//             gap: '16px'
//           }}>
//             <view style={{
//               width: '80px',
//               height: '80px',
//               borderRadius: '40px',
//               backgroundColor: '#e0e0e0',
//               display: 'flex',
//               justifyContent: 'center',
//               alignItems: 'center'
//             }}>
//               <text style={{ fontSize: '32px' }}>💬</text>
//             </view>
//             <text style={{ fontSize: '18px', color: '#666666', textAlign: 'center' }}>
//               No conversations yet
//             </text>
//             <text style={{ fontSize: '14px', color: '#999999', textAlign: 'center' }}>
//               Tap + to search for users
//             </text>
//           </view>
//         ) : (
//           <list style={{ width: '100%', height: '100%' }}>
//             {chats.map((chat) => (
//               <list-item key={chat.id} item-key={chat.id}>
//                 <view
//                   style={{
//                     backgroundColor: '#ffffff',
//                     borderRadius: '12px',
//                     padding: '16px',
//                     marginBottom: '8px',
//                     display: 'flex',
//                     flexDirection: 'row',
//                     alignItems: 'center',
//                     gap: '12px'
//                   }}
//                   bindtap={() => onOpenChat(chat.id)}
//                 >
//                   <view style={{
//                     width: '48px',
//                     height: '48px',
//                     borderRadius: '24px',
//                     backgroundColor: '#007AFF',
//                     display: 'flex',
//                     justifyContent: 'center',
//                     alignItems: 'center'
//                   }}>
//                     <text style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold' }}>
//                       {chat.username.charAt(0).toUpperCase()}
//                     </text>
//                   </view>
                  
//                   <view style={{ flex: 1 }}>
//                     <view style={{
//                       display: 'flex',
//                       flexDirection: 'row',
//                       justifyContent: 'space-between',
//                       alignItems: 'center'
//                     }}>
//                       <text style={{ fontSize: '16px', fontWeight: 'bold', color: '#333333' }}>
//                         @{chat.username}
//                       </text>
//                       <text style={{ fontSize: '12px', color: '#999999' }}>
//                         {formatTime(chat.timestamp)}
//                       </text>
//                     </view>
//                     <text style={{ fontSize: '14px', color: '#666666', marginTop: '4px' }}>
//                       {chat.lastMessage || 'Start a conversation'}
//                     </text>
//                   </view>

//                   {chat.unreadCount > 0 && (
//                     <view style={{
//                       minWidth: '20px',
//                       height: '20px',
//                       borderRadius: '10px',
//                       backgroundColor: '#ff3333',
//                       display: 'flex',
//                       justifyContent: 'center',
//                       alignItems: 'center',
//                       paddingLeft: '6px',
//                       paddingRight: '6px'
//                     }}>
//                       <text style={{ color: '#ffffff', fontSize: '12px', fontWeight: 'bold' }}>
//                         {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
//                       </text>
//                     </view>
//                   )}
//                 </view>
//               </list-item>
//             ))}
//           </list>
//         )}
//       </view>
//     </view>
//   );
// };

// // Search Page
// const SearchPage = ({ onBack, onAddChat, currentUser }: { onBack: () => void; onAddChat: (username: string) => void; currentUser: string; }) => {
//   const [searchQuery, setSearchQuery] = useState<string>('');
//   const [results, setResults] = useState<UserProfile[]>([]);
//   const [loading, setLoading] = useState<boolean>(false);
//   const [error, setError] = useState<string>('');

//   const handleSearch = useCallback(async (query: string) => {
//     setLoading(true);
//     setError('');
//     try {
//       const users = await api.searchUsers(query);
//       setResults(users);
//     } catch (err: any) {
//       setError(err.message || 'Search failed');
//       setResults([]);
//     } finally {
//       setLoading(false);
//     }
//   }, []);

//   useEffect(() => {
//     handleSearch('');
//   }, [handleSearch]);

//   return (
//     <view style={{ 
//       width: '100%', 
//       height: '100vh', 
//       backgroundColor: '#f0f0f0', 
//       display: 'flex', 
//       flexDirection: 'column' 
//     }}>
//       {/* Header */}
//       <view style={{ height: '100px', backgroundColor: '#007AFF', padding: '20px', paddingTop: '40px' }}>
//         <view style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '16px' }}>
//           <view style={{ width: '40px', height: '40px', backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} bindtap={onBack}>
//             <text style={{ color: '#ffffff', fontSize: '18px' }}>←</text>
//           </view>
//           <text style={{ color: '#ffffff', fontSize: '20px', fontWeight: 'bold' }}>Search Users</text>
//         </view>
//       </view>
      
//       {/* Search Input */}
//       <view style={{ padding: '16px' }}>
//         <view style={{ display: 'flex', flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: '24px', padding: '8px', gap: '8px' }}>
//           <input value={searchQuery} placeholder="Search users..." bindinput={(e: { detail: { value: string } }) => setSearchQuery(e.detail.value)} style={{ flex: 1, height: '40px', border: 'none', outline: 'none', fontSize: '16px', paddingLeft: '16px' }} />
//           <view style={{ width: '40px', height: '40px', backgroundColor: loading ? '#cccccc' : '#007AFF', borderRadius: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} bindtap={!loading ? () => handleSearch(searchQuery) : undefined}>
//             <text style={{ color: '#ffffff' }}>{loading ? '⏳' : '🔍'}</text>
//           </view>
//         </view>
//       </view>
      
//       {/* Error Display */}
//       {error && (<view style={{ padding: '0 16px' }}><text style={{ fontSize: '14px', color: '#ff3333', textAlign: 'center' }}>{error}</text></view>)}
      
//       {/* Search Results */}
//       <scroll-view style={{ flex: 1, padding: '0 16px' }} scroll-orientation="vertical">
//         {!loading && results.length === 0 && (<text style={{ textAlign: 'center', color: '#666', marginTop: '20px' }}>No users found.</text>)}
//         {results.map((user) => (
//           <view key={user.username} style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', marginBottom: '8px', display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }} bindtap={() => onAddChat(user.username)}>
//             <view style={{ width: '48px', height: '48px', borderRadius: '24px', backgroundColor: '#007AFF', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
//               <text style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold' }}>{user.username.charAt(0).toUpperCase()}</text>
//             </view>
//             <text style={{ fontSize: '16px', fontWeight: 'bold', color: '#333333', flex: 1 }}>@{user.username}</text>
//             <text style={{ fontSize: '20px', color: '#007AFF' }}>+</text>
//           </view>
//         ))}
//       </scroll-view>
//     </view>
//   );
// };

// // Chat Page - FINAL FIXED CODE
// const ChatPage = ({ 
//   chat, 
//   onBack, 
//   currentUser, 
//   onUpdateMessages 
// }: { 
//   chat: Chat; 
//   onBack: () => void; 
//   currentUser: string; 
//   onUpdateMessages: (chatId: string, messages: Message[]) => void; 
// }) => {
//   const [inputContent, setInputContent] = useState<string>('');
//   const [messages, setMessages] = useState<Message[]>(chat.messages);
//   const [loading, setLoading] = useState<boolean>(false);
//   const wsConnected = true; // Assuming connection is managed globally

//   // Setup chat-specific WebSocket handlers
//   useEffect(() => {
//     const handleNewMessage = (data: any) => {
//       if (data.chat_id === chat.id) {
//         const newMessage: Message = { 
//           ...data.message, 
//           type: data.message.username === currentUser ? 'user' : 'other' 
//         };
//         setMessages(prev => {
//           const updated = [...prev, newMessage];
//           onUpdateMessages(chat.id, updated);
//           return updated;
//         });
//       }
//     };

//     const handleMessagesLoaded = (data: any) => {
//       if (data.chat_id === chat.id) {
//         const loadedMessages = data.messages.map((msg: any) => ({ 
//           ...msg, 
//           type: msg.username === currentUser ? 'user' : 'other' 
//         }));
//         setMessages(loadedMessages);
//         onUpdateMessages(chat.id, loadedMessages);
//       }
//     };

//     wsManager.onMessage('new_message', handleNewMessage);
//     wsManager.onMessage('messages_loaded', handleMessagesLoaded);
//     api.joinChat(chat.id);

//     return () => {
//       wsManager.offMessage('new_message', handleNewMessage);
//       wsManager.offMessage('messages_loaded', handleMessagesLoaded);
//     };
//   }, [chat.id, currentUser, onUpdateMessages]);

//   const handleSend = useCallback(async () => {
//     const content = inputContent.trim();
//     if (!content || loading) return;
//     setLoading(true);
//     setInputContent('');
//     try {
//       api.sendMessage(chat.id, content);
//     } catch (err: any) {
//       console.error('Failed to send message:', err);
//       setInputContent(content);
//     } finally {
//       setLoading(false);
//     }
//   }, [inputContent, loading, chat.id]);

//   const handleImageSend = useCallback(async () => {
//     if (loading) return;
//     setLoading(true);
//     const mockImageUrl = `https://picsum.photos/400/300?random=${Date.now()}`;
//     try {
//       api.sendMessage(chat.id, '', mockImageUrl);
//     } catch (err: any) {
//       console.error('Failed to send image:', err);
//     } finally {
//       setLoading(false);
//     }
//   }, [loading, chat.id]);

//   return (
//     <view style={{
//       width: '100%',
//       height: '100%',
//       backgroundColor: '#f0f0f0',
//       display: 'flex',
//       flexDirection: 'column'
//     }}>
//       {/* Header */}
//       <view style={{
//         height: '100px',
//         backgroundColor: '#007AFF',
//         padding: '20px',
//         paddingTop: '40px'
//       }}>
//         <view style={{
//           display: 'flex',
//           flexDirection: 'row',
//           alignItems: 'center',
//           gap: '16px'
//         }}>
//           <view
//             style={{
//               width: '40px',
//               height: '40px',
//               backgroundColor: 'rgba(255, 255, 255, 0.2)',
//               borderRadius: '20px',
//               display: 'flex',
//               justifyContent: 'center',
//               alignItems: 'center'
//             }}
//             bindtap={onBack}
//           >
//             <text style={{ color: '#ffffff', fontSize: '18px' }}>←</text>
//           </view>
//           <view style={{ flex: 1 }}>
//             <text style={{
//               color: '#ffffff',
//               fontSize: '18px',
//               fontWeight: 'bold'
//             }}>
//               @{chat.username}
//             </text>
//             <view style={{ 
//               display: 'flex', 
//               flexDirection: 'row', 
//               alignItems: 'center', 
//               gap: '8px' 
//             }}>
//               <text style={{
//                 color: 'rgba(255, 255, 255, 0.8)',
//                 fontSize: '12px'
//               }}>
//                 {wsConnected ? 'Online' : 'Reconnecting...'}
//               </text>
//               <view style={{
//                 width: '6px',
//                 height: '6px',
//                 borderRadius: '3px',
//                 backgroundColor: wsConnected ? '#00ff00' : '#ffaa00'
//               }} />
//             </view>
//           </view>
//         </view>
//       </view>

//       {/* Messages Container - FIXED: Using <list> with string item-key */}
//       <view style={{ flex: 1, position: 'relative' }}>
//         <list 
//           style={{ 
//             width: '100%', 
//             height: '100%',
//             padding: '8px',
//             paddingBottom: '120px'
//           }} 
//         >
//           {messages.map((message) => (
//             <list-item key={message.id} item-key={message.id}>
//               <view 
//                 style={{
//                   padding: '4px 8px',
//                   display: 'flex',
//                   flexDirection: 'row',
//                   justifyContent: message.username === currentUser ? 'flex-end' : 'flex-start',
//                   marginBottom: '8px'
//                 }}
//               >
//                 <view style={{
//                   maxWidth: '75%',
//                   backgroundColor: message.username === currentUser ? '#007AFF' : '#ffffff',
//                   borderRadius: '16px',
//                   padding: message.imageUrl ? '4px' : '12px 16px',
//                   border: message.username === currentUser ? 'none' : '1px solid #e0e0e0'
//                 }}>
//                   {message.imageUrl ? (
//                     <image
//                       src={message.imageUrl}
//                       style={{
//                         width: '200px',
//                         height: '150px',
//                         borderRadius: '12px'
//                       }}
//                     />
//                   ) : (
//                     <text style={{
//                       color: message.username === currentUser ? '#ffffff' : '#333333',
//                       fontSize: '15px'
//                     }}>
//                       {message.content}
//                     </text>
//                   )}
//                 </view>
//               </view>
//             </list-item>
//           ))}
//         </list>
//       </view>

//       {/* Input Bar */}
//       <view style={{
//         position: 'absolute',
//         left: '0px',
//         right: '0px',
//         bottom: '20px',
//         padding: '0 16px'
//       }}>
//         <view style={{
//           backgroundColor: '#ffffff',
//           borderRadius: '24px',
//           padding: '8px',
//           border: '1px solid #e0e0e0'
//         }}>
//           <view style={{
//             display: 'flex',
//             flexDirection: 'row',
//             alignItems: 'center',
//             gap: '8px'
//           }}>
//             <view
//               style={{
//                 width: '36px',
//                 height: '36px',
//                 borderRadius: '18px',
//                 backgroundColor: loading ? '#cccccc' : '#f0f0f0',
//                 display: 'flex',
//                 justifyContent: 'center',
//                 alignItems: 'center'
//               }}
//               bindtap={!loading ? handleImageSend : undefined}
//             >
//               <text style={{ fontSize: '16px' }}>📷</text>
//             </view>
//             <input
//               value={inputContent}
//               placeholder="Type a message..."
//               bindinput={(e: { detail: { value: string } }) => setInputContent(e.detail.value)}
//               style={{
//                 flex: 1,
//                 height: '40px',
//                 border: 'none',
//                 outline: 'none',
//                 fontSize: '15px',
//                 padding: '10px 12px'
//               }}
//             />
//             <view
//               style={{
//                 width: '36px',
//                 height: '36px',
//                 borderRadius: '18px',
//                 backgroundColor: (inputContent.trim() && !loading && wsConnected) ? '#007AFF' : '#f0f0f0',
//                 display: 'flex',
//                 justifyContent: 'center',
//                 alignItems: 'center'
//               }}
//               bindtap={(inputContent.trim() && !loading && wsConnected) ? handleSend : undefined}
//             >
//               <text style={{
//                 color: (inputContent.trim() && !loading && wsConnected) ? '#ffffff' : '#999999',
//                 fontSize: '16px',
//                 fontWeight: 'bold'
//               }}>
//                 {loading ? '⏳' : '↑'}
//               </text>
//             </view>
//           </view>
//         </view>
//       </view>
//     </view>
//   );
// };

// // Main App Component (FIXED)
// export const App = (props: { onRender?: () => void }) => {
//   const [currentPage, setCurrentPage] = useState<'setup' | 'chatList' | 'search' | 'chat'>('setup');
//   const [currentUser, setCurrentUser] = useState<string>('');
//   const [chats, setChats] = useState<Chat[]>([]);
//   const [selectedChatId, setSelectedChatId] = useState<string>('');
//   const [isConnected, setIsConnected] = useState<boolean>(false);

//   // WebSocket event handlers - FIXED to avoid duplicate listeners
//   useEffect(() => {
//     if (!currentUser || !isConnected) return;

//     const handleChatListUpdate = (data: any) => {
//       console.log('Received chat list update from WebSocket:', data.type);
//       const chatsWithTypes = data.chats.map((chat: any) => ({
//         ...chat,
//         messages: chat.messages.map((msg: any) => ({
//           ...msg,
//           type: msg.username === currentUser ? 'user' : 'other'
//         }))
//       }));
//       setChats(chatsWithTypes);
//     };

//     wsManager.onMessage('chats_updated', handleChatListUpdate);

//     return () => {
//       wsManager.offMessage('chats_updated', handleChatListUpdate);
//     };
//   }, [currentUser, isConnected]);

//   // Initialize user session - FIXED to handle connection properly
//   const initializeUserSession = useCallback(async (username: string) => {
//     if (!username) return;

//     console.log(`Initializing session for ${username}...`);
//     setCurrentUser(username);
//     setCurrentPage('chatList');

//     try {
//       console.log(`Connecting WebSocket for ${username}...`);
//       await wsManager.connect(username);
//       setIsConnected(true);
//       console.log('WebSocket connected. Fetching initial chats...');
      
//       const initialChats = await api.getUserChats();
//       const chatsWithTypes = initialChats.map((chat: any) => ({
//         ...chat,
//         messages: chat.messages.map((msg: any) => ({
//           ...msg,
//           type: msg.username === username ? 'user' : 'other'
//         }))
//       }));
//       setChats(chatsWithTypes);
//       console.log('Initial chats loaded successfully.');

//     } catch (err) {
//       console.error("Failed to initialize user session:", err);
//       setIsConnected(false);
//     }
//   }, []);

//   // Initial load - FIXED to properly handle saved profiles
//   useEffect(() => {
//     console.log('Lynx Chat App initialized');
//     props.onRender?.();
    
//     const savedProfile = Storage.getItem('userProfile');
//     if (savedProfile?.username) {
//       initializeUserSession(savedProfile.username);
//     }
//   }, [props, initializeUserSession]);

//   const handleUsernameComplete = useCallback((username: string) => {
//     initializeUserSession(username);
//   }, [initializeUserSession]);

//   const handleAddChat = useCallback(async (username: string) => {
//     try {
//       await api.createChat(username);
//       setCurrentPage('chatList');
//     } catch (err) {
//       console.error('Failed to create chat:', err);
//     }
//   }, []);

//   const handleOpenChat = useCallback((chatId: string) => {
//     setSelectedChatId(chatId);
//     setCurrentPage('chat');
//   }, []);

//   const handleUpdateMessages = useCallback((chatId: string, newMessages: Message[]) => {
//     setChats(prev => {
//       return prev.map(chat => {
//         if (chat.id === chatId) {
//           const lastMessage = newMessages[newMessages.length - 1];
//           return {
//             ...chat,
//             messages: newMessages,
//             lastMessage: lastMessage?.content || (lastMessage?.imageUrl ? '📷 Image' : ''),
//             timestamp: lastMessage?.timestamp || chat.timestamp
//           };
//         }
//         return chat;
//       });
//     });
//   }, []);

//   const selectedChat = chats.find(chat => chat.id === selectedChatId);

//   // Page routing - FIXED to ensure proper rendering
//   if (currentPage === 'setup') {
//     return <UsernameSetupPage onComplete={handleUsernameComplete} />;
//   }
  
//   if (currentPage === 'search') {
//     return (
//       <SearchPage
//         onBack={() => setCurrentPage('chatList')}
//         onAddChat={handleAddChat}
//         currentUser={currentUser}
//       />
//     );
//   }
  
//   if (currentPage === 'chat' && selectedChat) {
//     return (
//       <ChatPage
//         chat={selectedChat}
//         onBack={() => setCurrentPage('chatList')}
//         currentUser={currentUser}
//         onUpdateMessages={handleUpdateMessages}
//       />
//     );
//   }
  
//   // Default to chat list
//   return (
//     <ChatListPage
//       currentUser={currentUser}
//       onSearchUsers={() => setCurrentPage('search')}
//       chats={chats}
//       onOpenChat={handleOpenChat}
//       onChatsUpdate={setChats}
//     />
//   );
// };