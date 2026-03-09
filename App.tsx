
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Compass, ChevronLeft, Send, LogOut, X, 
  Sparkles, MessageSquare, Search, Trash2, 
  Volume2, Info, MoreHorizontal, ImageIcon, User as UserIcon,
  Settings, Camera, ShieldCheck, Heart, Eye, EyeOff,
  Share2, Pencil, Globe, ChevronDown, Check, BadgeCheck
} from 'lucide-react';
import * as firebase from 'firebase/app';
import { getDatabase, ref, set, get, onValue, remove } from 'firebase/database';
import { User as UserType, Bot, ChatMessage } from './types';
import { geminiService } from './services/geminiService';

const firebaseConfig = { databaseURL: "https://crack-decorator-469319-i0-default-rtdb.firebaseio.com/" };
const app = firebase.initializeApp(firebaseConfig);
const db = getDatabase(app);

const MASTER_ADMIN_EMAIL = "gn375294@gmail.com";

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\*[^*]+\*|"[^"]+"|\([^)]+\))/g);
  return (
    <div className="font-sans text-[#ececed] leading-relaxed text-[16px] space-y-1">
      {parts.map((part, i) => {
        if (!part) return null;
        if (part.startsWith('*') && part.endsWith('*')) return <span key={i} className="italic text-zinc-400 font-normal">{part.slice(1, -1)}</span>;
        if (part.startsWith('"') && part.endsWith('"')) return <span key={i} className="text-white font-semibold">{part}</span>;
        if (part.startsWith('(') && part.endsWith(')')) return <span key={i} className="text-zinc-500 italic opacity-80">{part}</span>;
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
};

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserType | null>(() => {
    const saved = localStorage.getItem('talk_app_user');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [view, setView] = useState<'auth' | 'main' | 'chat' | 'profile' | 'create-bot'>('auth');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [bots, setBots] = useState<Bot[]>([]);
  const [activeBot, setActiveBot] = useState<Bot | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingStep, setThinkingStep] = useState(0);

  const [loginEmail, setLoginEmail] = useState(''); 
  const [loginPass, setLoginPass] = useState('');
  const [loginName, setLoginName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [shouldShake, setShouldShake] = useState(false);

  const [newBotName, setNewBotName] = useState('');
  const [newBotGreeting, setNewBotGreeting] = useState('');
  const [newBotPersonality, setNewBotPersonality] = useState('');

  const thinkingMessages = [
    "Analisando contexto...",
    "Processando sentimentos...",
    "Formulando resposta...",
    "Ajustando tom neural..."
  ];

  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: any;
    if (isLoading) {
      interval = setInterval(() => {
        setThinkingStep(prev => (prev + 1) % thinkingMessages.length);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  useEffect(() => {
    if (currentUser) {
      const botsRef = ref(db, 'bots');
      const unsubscribe = onValue(botsRef, (snap) => {
        const data = snap.val() ? Object.values(snap.val()) as Bot[] : [];
        setBots(data);
        
        // Se o bot ativo foi deletado por outro processo ou por mim
        if (activeBot && !data.find(b => b.id === activeBot.id)) {
          setActiveBot(null);
          if (view === 'chat') setView('main');
        }
      });

      if (view === 'auth') setView('main');
      return () => unsubscribe();
    } else {
      setView('auth');
    }
  }, [currentUser, activeBot, view]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, view, isLoading]);

  const sanitizeName = (name: string) => name.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();

  const triggerAuthError = (msg: string) => {
    setAuthError(msg);
    setLoginPass('');
    setShouldShake(true);
    if (navigator.vibrate) navigator.vibrate(200);
    setTimeout(() => setShouldShake(false), 500);
  };

  const handleLogout = () => {
    localStorage.removeItem('talk_app_user');
    setCurrentUser(null);
    setView('auth');
    setActiveBot(null);
    setLoginEmail('');
    setLoginPass('');
    setAuthError('');
  };

  const deleteAccount = async () => {
    if (!currentUser || !confirm("CUIDADO: Isso apagará sua conta e todos os seus dados. Continuar?")) return;
    setIsLoading(true);
    try {
      const nameClean = sanitizeName(currentUser.name);
      await remove(ref(db, `usuarios/${nameClean}`));
      handleLogout();
    } catch (e) { alert("Erro ao excluir conta."); }
    setIsLoading(false);
  };

  const deleteBot = async (botId: string | number) => {
    if (!confirm("Deseja apagar este rastro neural permanentemente?")) return;
    try {
      await remove(ref(db, `bots/${botId}`));
      // O useEffect onValue cuidará de atualizar a lista e sair do chat se necessário
    } catch (e) { alert("Erro ao excluir bot."); }
  };

  const handleAuth = async () => {
    setAuthError('');
    const email = loginEmail.trim().toLowerCase();
    const pass = loginPass.trim();
    if (!email || !pass) return triggerAuthError("Preencha todos os campos.");
    
    setIsLoading(true);
    try {
      const snap = await get(ref(db, 'usuarios'));
      const users = snap.val() ? Object.values(snap.val()) as UserType[] : [];
      
      if (authMode === 'login') {
        const user = users.find(u => u.email === email);
        if (!user) {
          triggerAuthError("Usuário não encontrado.");
        } else if (String(user.password) !== pass) {
          triggerAuthError("Senha incorreta.");
        } else {
          if (user.email === MASTER_ADMIN_EMAIL) user.admin = true;
          setCurrentUser(user);
          localStorage.setItem('talk_app_user', JSON.stringify(user));
        }
      } else {
        if (!loginName.trim()) return triggerAuthError("Nome é obrigatório.");
        const nameClean = sanitizeName(loginName);
        if (users.some(u => sanitizeName(u.name) === nameClean)) return triggerAuthError("Nome em uso.");
        const newUser: UserType = { id: Date.now(), name: loginName, email, password: pass, admin: email === MASTER_ADMIN_EMAIL, verified: email === MASTER_ADMIN_EMAIL };
        await set(ref(db, `usuarios/${nameClean}`), newUser);
        setCurrentUser(newUser);
        localStorage.setItem('talk_app_user', JSON.stringify(newUser));
      }
    } catch (e) { triggerAuthError("Erro de rede."); }
    setIsLoading(false);
  };

  const openChat = (bot: Bot) => {
    setActiveBot(bot);
    setIsRightSidebarOpen(false);
    setView('chat');
    
    const savedChat = localStorage.getItem(`talk_chat_${bot.id}`);
    if (savedChat) {
      setMessages(JSON.parse(savedChat));
    } else {
      const initialMessages = bot.greeting ? [{ 
        content: bot.greeting, 
        senderName: bot.name, 
        creatorEmail: 'system', 
        isVerified: true, 
        isAdmin: false, 
        timestamp: Date.now() 
      }] : [];
      setMessages(initialMessages);
      if (initialMessages.length > 0) {
        localStorage.setItem(`talk_chat_${bot.id}`, JSON.stringify(initialMessages));
      }
    }
  };

  const clearHistory = () => {
    if (!activeBot || !confirm("Apagar toda a conversa com este bot?")) return;
    const resetMessages = activeBot.greeting ? [{ 
      content: activeBot.greeting, 
      senderName: activeBot.name, 
      creatorEmail: 'system', 
      isVerified: true, 
      isAdmin: false, 
      timestamp: Date.now() 
    }] : [];
    setMessages(resetMessages);
    localStorage.setItem(`talk_chat_${activeBot.id}`, JSON.stringify(resetMessages));
  };

  const createBot = async () => {
    if (!currentUser || !newBotName || !newBotGreeting || !newBotPersonality) {
      return alert("Preencha todos os campos.");
    }
    setIsLoading(true);
    try {
      const id = Date.now().toString();
      const newBot: Bot = {
        id,
        name: newBotName,
        greeting: newBotGreeting,
        personality: newBotPersonality,
        image: `https://picsum.photos/seed/${id}/400/400`, 
        creatorName: currentUser.name,
        creatorEmail: currentUser.email,
        creatorId: currentUser.id,
        isVerifiedCreator: currentUser.verified,
        isAdminCreator: currentUser.admin,
        timestamp: Date.now(),
        chatCount: 0
      };
      await set(ref(db, `bots/${id}`), newBot);
      setNewBotName('');
      setNewBotGreeting('');
      setNewBotPersonality('');
      setView('main');
    } catch (e) { alert("Erro ao criar bot."); }
    setIsLoading(false);
  };

  const sendMessage = async () => {
    const input = chatInputRef.current?.value || '';
    if (!input.trim() || !currentUser || !activeBot) return;
    chatInputRef.current!.value = '';

    const newMsg: ChatMessage = { 
      content: input, senderName: currentUser.name, creatorEmail: currentUser.email, 
      isVerified: currentUser.verified, isAdmin: currentUser.admin, timestamp: Date.now() 
    };

    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    localStorage.setItem(`talk_chat_${activeBot.id}`, JSON.stringify(updatedMessages));

    setIsLoading(true);
    const res = await geminiService.getChatResponse(activeBot, updatedMessages, input);
    
    const botMsg: ChatMessage = { 
      content: res, senderName: activeBot.name, creatorEmail: 'system', 
      isVerified: true, isAdmin: false, timestamp: Date.now() 
    };
    
    const finalMessages = [...updatedMessages, botMsg];
    setMessages(finalMessages);
    localStorage.setItem(`talk_chat_${activeBot.id}`, JSON.stringify(finalMessages));
    setIsLoading(false);
  };

  const filteredBots = bots.filter(b => 
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    b.personality.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const myBots = bots.filter(b => b.creatorEmail === currentUser?.email);

  if (view === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-6">
        <div className={`max-w-md w-full space-y-8 bg-[#18181b] p-10 rounded-[2.5rem] border border-white/5 shadow-2xl transition-all ${shouldShake ? 'animate-shake border-red-600/50' : ''}`}>
          <div className="text-center">
            <h1 className="text-5xl font-black italic text-red-600 mb-2 uppercase tracking-tighter">TALK</h1>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em]">Neural Interface</p>
          </div>
          <div className="space-y-4">
            {authMode === 'register' && (
              <input value={loginName} onChange={e => {setLoginName(e.target.value); setAuthError('');}} placeholder="Como quer ser chamado?" className="w-full bg-white/5 p-4 rounded-xl border border-white/10 outline-none text-sm focus:border-red-600 transition-all"/>
            )}
            <input value={loginEmail} onChange={e => {setLoginEmail(e.target.value); setAuthError('');}} type="email" placeholder="E-mail" className="w-full bg-white/5 p-4 rounded-xl border border-white/10 outline-none text-sm focus:border-red-600 transition-all"/>
            <div className="relative group">
              <input 
                value={loginPass} 
                onChange={e => {setLoginPass(e.target.value); setAuthError('');}} 
                type={showPassword ? "text" : "password"} 
                placeholder="Senha" 
                className="w-full bg-white/5 p-4 rounded-xl border border-white/10 outline-none text-sm focus:border-red-600 transition-all pr-12"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors">
                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
              </button>
            </div>
            
            <div className="h-4">
              {authError && (
                <p className={`text-red-500 text-[11px] font-bold uppercase tracking-wider animate-fadeIn ${shouldShake ? 'animate-shake' : ''}`}>
                  {authError}
                </p>
              )}
            </div>

            <button onClick={handleAuth} disabled={isLoading} className="w-full bg-red-600 py-4 rounded-xl font-black uppercase shadow-lg hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50">
              {isLoading ? 'Conectando...' : authMode === 'login' ? 'Entrar' : 'Criar Identidade'}
            </button>

            <button onClick={() => {setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('');}} className="w-full text-zinc-500 text-[10px] font-black uppercase tracking-widest text-center mt-2">
              {authMode === 'login' ? 'Novo por aqui? Criar rastro' : 'Já possui registro? Acessar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#121212] text-white overflow-hidden font-sans">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-[#18181b] flex flex-col transition-all border-r border-white/5 z-40`}>
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
             <div className="p-1.5 bg-red-600 rounded-lg shadow-lg shadow-red-600/20"><Sparkles size={16} className="text-white"/></div>
             {sidebarOpen && <h2 className="font-black text-xl italic tracking-tighter text-white">TALK ia</h2>}
          </div>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 text-zinc-600 hover:text-white"><ChevronLeft size={18} className={!sidebarOpen ? 'rotate-180' : ''}/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto hide-scrollbar p-3 space-y-4">
          <div className="space-y-1">
             <button onClick={() => setView('create-bot')} className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all text-[13px] font-bold uppercase tracking-tight ${view === 'create-bot' ? 'bg-white/10 text-red-500' : 'hover:bg-white/5'}`}><Plus size={20}/> {sidebarOpen && "Criar"}</button>
             <button onClick={() => setView('main')} className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all text-[13px] font-bold uppercase tracking-tight ${view === 'main' ? 'bg-white/10 text-red-500' : 'hover:bg-white/5'}`}><Compass size={20}/> {sidebarOpen && "Descobrir"}</button>
          </div>

          <div className="pt-4 space-y-2">
            {sidebarOpen && <h3 className="px-3 text-[10px] font-black uppercase text-zinc-700 tracking-[0.2em] mb-2">Recentes</h3>}
            {bots.slice(0, 8).map(bot => (
              <button key={bot.id} onClick={() => openChat(bot)} className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all group ${activeBot?.id === bot.id ? 'bg-red-600/5' : 'hover:bg-white/5'}`}>
                <img src={bot.image} className="w-8 h-8 rounded-full object-cover border border-white/5" />
                {sidebarOpen && <div className="flex-1 text-left"><p className="text-[13px] font-medium truncate">{bot.name}</p></div>}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 border-t border-white/5 bg-black/20">
          <button onClick={() => setView('profile')} className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all text-left group">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center font-black text-xs uppercase text-white shadow-lg group-hover:scale-110 transition-transform">{currentUser?.name?.charAt(0) || '?'}</div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold truncate uppercase tracking-tighter text-blue-400">@{sanitizeName(currentUser?.name || '')}</p>
                <p className="text-[9px] text-zinc-600 font-black uppercase">Meu Perfil</p>
              </div>
            )}
          </button>
          {sidebarOpen && (
            <button onClick={handleLogout} className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-zinc-900/50 hover:bg-red-900/20 text-zinc-500 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-all">
              <LogOut size={12}/> Sair
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-[#121212] flex flex-col relative">
        {view === 'main' && (
          <div className="p-8 md:p-12 max-w-7xl mx-auto w-full animate-fadeIn">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
               <div className="flex-1">
                 <h2 className="text-4xl font-black italic mb-2 tracking-tighter uppercase">Descobrir</h2>
                 <p className="text-zinc-500 text-sm font-medium">Explore consciências neurais.</p>
               </div>
               <div className="relative w-full md:w-96 group">
                  <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-red-600 transition-colors"/>
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar..." className="w-full bg-[#18181b] py-4 pl-12 pr-4 rounded-2xl text-sm outline-none border border-white/5 focus:border-red-600/50 transition-all shadow-xl"/>
               </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {filteredBots.map(bot => (
                <div key={bot.id} onClick={() => openChat(bot)} className="cai-card flex flex-col group cursor-pointer h-[280px]">
                   <div className="relative h-[70%] overflow-hidden">
                      <img src={bot.image} className="w-full h-full object-cover transition duration-700 group-hover:scale-110" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] via-transparent to-transparent opacity-90"></div>
                      <div className="absolute bottom-3 left-4 right-4">
                         <h3 className="font-bold text-base tracking-tight text-white drop-shadow-md truncate">{bot.name}</h3>
                         <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest truncate">@{bot.creatorName}</span>
                            {(bot.isVerifiedCreator || bot.creatorId === 1 || bot.creatorId === "1") && <BadgeCheck size={12} className="text-blue-500 shrink-0" />}
                         </div>
                      </div>
                   </div>
                   <div className="p-4 flex-1 flex flex-col justify-center">
                      <p className="text-[11px] text-zinc-400 line-clamp-2 italic leading-relaxed font-medium">"{bot.greeting || bot.personality.slice(0, 60)}"</p>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'profile' && currentUser && (
          <div className="flex flex-col h-full bg-[#121212] overflow-y-auto hide-scrollbar animate-fadeIn">
            <header className="p-6 flex items-center justify-between">
               <button onClick={() => setView('main')} className="p-2 text-zinc-400 hover:text-white transition-all"><ChevronLeft size={24}/></button>
               <button onClick={deleteAccount} className="text-[10px] font-black uppercase text-red-600/50 hover:text-red-600 transition-colors tracking-[0.2em]">Excluir Conta</button>
            </header>

            <div className="flex flex-col items-center px-6 mt-4">
               <div className="w-32 h-32 rounded-full bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center overflow-hidden mb-6 shadow-2xl relative">
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-4xl font-bold text-zinc-600 uppercase">
                    {currentUser.name.charAt(0)}
                  </div>
               </div>

               <div className="flex items-center gap-2 mb-1">
                 <h2 className="text-2xl font-bold tracking-tight text-blue-400">{currentUser.name}</h2>
                 {currentUser.verified && <BadgeCheck size={20} className="text-blue-500" />}
               </div>
               <p className="text-zinc-500 text-sm font-medium mb-6 italic tracking-tight">@{sanitizeName(currentUser.name)}</p>

               <div className="flex items-center gap-4 text-zinc-400 text-sm font-medium mb-10">
                  <div className="flex items-center gap-1.5">
                    <span className="text-blue-400 font-bold">{myBots.length}</span> bots criados
                  </div>
                  <div className="w-1 h-1 bg-zinc-700 rounded-full"></div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-bold">{currentUser.totalFollowers || 0}</span> seguidores
                  </div>
               </div>

               <div className="flex items-center gap-3 mb-10">
                  <button className="flex items-center gap-2.5 px-6 py-2.5 bg-[#212124] rounded-full text-zinc-100 font-bold text-sm hover:bg-zinc-800 transition-all border border-zinc-800 shadow-lg">
                    <Pencil size={16} /> Editar
                  </button>
                  <button className="p-2.5 bg-[#212124] rounded-full text-zinc-100 hover:bg-zinc-800 transition-all border border-zinc-800 shadow-lg"><Share2 size={18} /></button>
               </div>
            </div>

            <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
               <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-600 mb-6">Meus Personagens</h3>
               <div className="space-y-6 pb-20">
                  {myBots.map((bot, i) => (
                    <div key={bot.id} className="flex items-center gap-4 group animate-fadeIn" style={{ animationDelay: `${i * 100}ms` }}>
                       <div onClick={() => openChat(bot)} className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0 shadow-xl border border-white/5 cursor-pointer hover:scale-105 transition-transform">
                          <img src={bot.image} className="w-full h-full object-cover" />
                       </div>
                       <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openChat(bot)}>
                          <div className="flex items-center gap-2">
                             <h4 className="font-bold text-base text-zinc-100 truncate">{bot.name}</h4>
                          </div>
                          <p className="text-zinc-500 text-xs font-medium truncate mb-2">{bot.greeting || bot.personality.slice(0, 60)}</p>
                          <div className="flex items-center gap-3 text-zinc-600">
                             <MessageSquare size={12}/>
                             <span className="text-[10px] font-bold">{bot.chatCount || 0} chats</span>
                          </div>
                       </div>
                       <button onClick={() => deleteBot(bot.id)} className="p-3 text-zinc-700 hover:text-red-600 transition-colors bg-white/5 rounded-full"><Trash2 size={18}/></button>
                    </div>
                  ))}
                  {myBots.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20"><Plus size={48} className="mb-4 text-zinc-600"/><p className="font-black uppercase tracking-[0.2em] text-xs">Vazio Neural</p></div>
                  )}
               </div>
            </div>
          </div>
        )}

        {view === 'create-bot' && (
          <div className="p-8 md:p-12 max-w-2xl mx-auto w-full animate-fadeIn">
             <div className="flex items-center justify-between mb-8">
                <button onClick={() => setView('main')} className="p-2 text-zinc-500 hover:text-white transition-colors"><ChevronLeft size={24}/></button>
                <h2 className="text-xl font-black italic tracking-tighter uppercase">Novo Personagem</h2>
                <div className="w-10"></div>
             </div>

             <div className="space-y-6 bg-[#18181b] p-8 rounded-[2.5rem] border border-white/5 shadow-2xl">
                <div>
                   <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2 block">Nome</label>
                   <input value={newBotName} onChange={e => setNewBotName(e.target.value)} placeholder="Ex: Akira" className="w-full bg-white/5 p-4 rounded-xl border border-white/10 outline-none text-sm focus:border-red-600 transition-all"/>
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2 block">Saudação Inicial</label>
                   <textarea value={newBotGreeting} onChange={e => setNewBotGreeting(e.target.value)} placeholder="A primeira mensagem do bot..." className="w-full bg-white/5 p-4 rounded-xl border border-white/10 outline-none text-sm focus:border-red-600 transition-all h-24 resize-none"/>
                </div>
                <div>
                   <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2 block">Personalidade</label>
                   <textarea value={newBotPersonality} onChange={e => setNewBotPersonality(e.target.value)} placeholder="Instruções neurais..." className="w-full bg-white/5 p-4 rounded-xl border border-white/10 outline-none text-sm focus:border-red-600 transition-all h-40 resize-none"/>
                </div>
                <button onClick={createBot} disabled={isLoading} className="w-full bg-red-600 py-5 rounded-2xl font-black uppercase shadow-lg hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3">
                  {isLoading ? 'Injetando...' : 'Criar Personagem'}
                </button>
             </div>
          </div>
        )}

        {view === 'chat' && activeBot && (
          <div className="flex-1 flex flex-col h-full bg-[#18181b]">
            <header className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#18181b]/95 backdrop-blur-xl sticky top-0 z-30 shadow-lg">
               <div className="flex items-center gap-4">
                  <button onClick={() => setView('main')} className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 hover:text-white transition-all"><ChevronLeft size={20}/></button>
                  <img src={activeBot.image} className="w-10 h-10 rounded-full object-cover border border-white/10 shadow-lg" />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                       <h3 className="font-bold text-sm tracking-tight">{activeBot.name}</h3>
                       {(activeBot.isVerifiedCreator || activeBot.creatorId === 1 || activeBot.creatorId === "1") && <BadgeCheck size={12} className="text-blue-500" />}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">por @{activeBot.creatorName}</span>
                      {(activeBot.isVerifiedCreator || activeBot.creatorId === 1) && <BadgeCheck size={9} className="text-blue-500 opacity-60" />}
                    </div>
                  </div>
               </div>
               <button onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)} className="p-2.5 hover:bg-white/5 rounded-xl text-zinc-500 hover:text-white transition-all"><MoreHorizontal size={20}/></button>
            </header>

            {isRightSidebarOpen && (
              <div className="absolute right-6 top-16 bg-[#212124] border border-white/10 p-4 rounded-2xl shadow-2xl z-50 animate-fadeIn min-w-[200px]">
                 <button onClick={clearHistory} className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl text-zinc-300 text-xs font-bold uppercase tracking-tight"><Trash2 size={16} className="text-red-500"/> Limpar Histórico</button>
                 {activeBot.creatorEmail === currentUser?.email && (
                    <button onClick={() => deleteBot(activeBot.id)} className="w-full flex items-center gap-3 p-3 hover:bg-red-900/20 rounded-xl text-red-500 text-xs font-bold uppercase tracking-tight"><X size={16}/> Deletar Personagem</button>
                 )}
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-6 py-10 space-y-10 max-w-4xl mx-auto w-full hide-scrollbar scroll-smooth">
               {messages.map((m, idx) => {
                 const isUser = m.senderName === currentUser?.name;
                 return (
                   <div key={idx} className={`flex gap-5 group ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fadeIn`}>
                      <div className={`w-9 h-9 rounded-full overflow-hidden flex-shrink-0 shadow-lg ${isUser ? 'bg-zinc-800' : 'bg-zinc-900 border border-white/10'}`}>
                        {isUser ? <div className="w-full h-full flex items-center justify-center font-black text-xs uppercase text-blue-400">{currentUser?.name?.charAt(0)}</div> : <img src={activeBot.image} className="w-full h-full object-cover" />}
                      </div>
                      <div className={`flex flex-col max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                           <span className={`text-[10px] font-black uppercase tracking-wider ${isUser ? 'text-blue-400' : 'text-zinc-500'}`}>{isUser ? 'Você' : m.senderName}</span>
                        </div>
                        <div className={`p-5 rounded-3xl leading-relaxed text-[16px] shadow-xl ${isUser ? 'bg-zinc-800 text-white rounded-tr-none' : 'bg-[#212124] text-zinc-100 rounded-tl-none border border-white/5'}`}>
                           {isUser ? m.content : <FormattedText text={m.content} />}
                        </div>
                      </div>
                   </div>
                 );
               })}
               {isLoading && (
                 <div className="flex gap-5 flex-row animate-fadeIn">
                    <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-zinc-900 border border-white/10 opacity-30"><img src={activeBot.image} className="w-full h-full object-cover grayscale" /></div>
                    <div className="bg-[#212124] px-6 py-5 rounded-3xl rounded-tl-none border border-white/5 flex flex-col gap-4 min-w-[240px] shadow-2xl border-l-2 border-l-red-600">
                       <div className="flex items-center gap-4">
                          <div className="w-5 h-5 border-2 border-red-600/20 border-t-red-600 rounded-full animate-spin"></div>
                          <span className="text-zinc-300 text-xs font-bold animate-pulse">{thinkingMessages[thinkingStep]}</span>
                       </div>
                    </div>
                 </div>
               )}
               <div ref={chatEndRef} />
            </div>

            <footer className="p-6 bg-[#18181b]/80 backdrop-blur-md">
               <div className="max-w-4xl mx-auto flex items-center gap-3 px-6 py-4 bg-[#262626] rounded-2xl border border-white/5 shadow-2xl">
                  <button className="p-2 text-zinc-600 hover:text-white transition-colors"><ImageIcon size={20}/></button>
                  <input ref={chatInputRef} disabled={isLoading} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder={`Escreva algo para ${activeBot.name}...`} className="flex-1 bg-transparent border-none outline-none py-1 text-sm text-zinc-200 placeholder:text-zinc-700"/>
                  <button disabled={isLoading} onClick={sendMessage} className="p-2 text-red-600 hover:text-red-500 transition-all hover:scale-110"><Send size={24}/></button>
               </div>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
