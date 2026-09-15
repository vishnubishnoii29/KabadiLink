import React, { useState, useRef, useEffect } from "react";
import { Language } from "../types";
import { MATERIALS_DATA } from "../data/mockData";
import { formatCurrency } from "../utils/formatters";
import {
  Send,
  Camera,
  Image as ImageIcon,
  CheckCheck,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Sparkles,
  Bot,
  User,
  Volume2,
  RefreshCw
} from "lucide-react";
import { AudioGuideEngine } from "../utils/speech";

interface WhatsAppSimulatorProps {
  language: Language;
}

interface Message {
  id: string;
  sender: "user" | "bot";
  text?: string;
  imageUrl?: string;
  timestamp: string;
}

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({ language }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "msg-init",
      sender: "bot",
      text:
        language === "hi"
          ? "नमस्ते! इको कबाड़ी एआई में आपका स्वागत है। अपने स्क्रैप (तांबे की तार, मदरबोर्ड, बैटरी आदि) का फोटो भेजें या भाव पूछें।"
          : language === "mr"
          ? "नमस्कार! इको कबाडी एआय मध्ये आपले स्वागत आहे. आपल्या स्क्रॅपचा फोटो पाठवा किंवा भाव विचारा."
          : "Namaste! Welcome to EcoKabadi AI. Send a photo of your scrap or ask for spot rates for copper, PCBs, batteries, and appliances.",
      timestamp: "Just now",
    },
  ]);

  const [inputVal, setInputVal] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendToGeminiBot = async (userText: string, imageBase64?: string) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai/whatsapp-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          conversationHistory: messages.slice(-8),
          imageBase64,
          language,
        }),
      });

      const data = await response.json();
      const botReply = data.reply || "Namaste! Please reply 1 for live auction, 2 for free truck pickup.";

      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: botReply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);

      // Readout if sound enabled
      AudioGuideEngine.speak(botReply.replace(/[*_#👉]/g, ""), language);
    } catch (error) {
      console.error("WhatsApp AI bot error:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: "bot",
          text: "Namaste! Copper is at ₹710/kg and Motherboards at ₹450/kg. Reply 1 for auction or 2 for truck pickup.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: inputVal,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    const currentInput = inputVal;
    setInputVal("");
    sendToGeminiBot(currentInput);
  };

  const handleSendSamplePhoto = (material: typeof MATERIALS_DATA[0]) => {
    if (isLoading) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "user",
      imageUrl: material.sampleImage,
      text: `Photo of ${material.name[language]} scrap. What is the fair price and purity?`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    sendToGeminiBot(`Analyze scrap: ${material.name[language]}`, material.sampleImage);
  };

  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        sender: "user",
        imageUrl: base64,
        text: "Please analyze my uploaded scrap photo.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, userMsg]);
      sendToGeminiBot("Analyze this e-waste scrap image and provide fair rate and purity", base64);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white text-[#12181A] p-6 rounded-2xl border border-[#E5E8E6] shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1E5128] animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-wider text-[#1E5128] font-semibold">
              Gemini WhatsApp E-Waste Assistant
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-[#12181A]">
            {language === "hi" ? "व्हाट्सएप चैटबॉट" : language === "mr" ? "व्हॉट्सॲप चॅटबॉट" : "WhatsApp AI Assistant"}
          </h2>
          <p className="text-sm text-[#4B5563] mt-1">
            {language === "hi"
              ? "बिना ऐप डाउनलोड किए सीधे फोटो भेजें और असली बाजार भाव जानें।"
              : "Direct valuation & advice for collectors on ground. Works via text and scrap photos."}
          </p>
        </div>

        {/* Quick Question Chips (Secondary Buttons) */}
        <div className="flex flex-wrap sm:flex-nowrap gap-2 shrink-0">
          <button
            onClick={() => {
              setInputVal("What is the live copper wire rate today?");
            }}
            className="min-h-[44px] text-sm bg-white hover:bg-[#F7F8F6] text-[#12181A] px-4 py-2 rounded-xl border border-[#E5E8E6] font-medium transition-colors cursor-pointer"
          >
            Copper Rate?
          </button>
          <button
            onClick={() => {
              setInputVal("Is it safe to dismantle microwave transformers?");
            }}
            className="min-h-[44px] text-sm bg-white hover:bg-[#F7F8F6] text-[#12181A] px-4 py-2 rounded-xl border border-[#E5E8E6] font-medium transition-colors cursor-pointer"
          >
            Safety check?
          </button>
        </div>
      </div>

      {/* WhatsApp Interface Wrapper */}
      <div className="bg-[#F7F8F6] border border-[#E5E8E6] rounded-2xl shadow-2xs overflow-hidden flex flex-col h-[620px]">
        {/* WhatsApp Top Bar */}
        <div className="bg-[#1E5128] text-white px-5 py-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-white border border-white/20">
              <Bot className="w-5 h-5 text-[#F0FDF4]" />
            </div>
            <div>
              <h3 className="font-semibold text-base leading-tight flex items-center gap-2">
                EcoKabadi AI Assistant
                <span className="bg-[#F0FDF4]/20 text-[#F0FDF4] text-xs px-2 py-0.5 rounded font-mono font-normal">CPCB Official</span>
              </h3>
              <p className="text-xs text-[#F0FDF4]/80">Online • Instant Rates & Pickup Dispatch</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-white/80">
            <Phone className="w-4 h-4 cursor-pointer hover:text-white" />
            <Video className="w-4 h-4 cursor-pointer hover:text-white" />
            <MoreVertical className="w-4 h-4 cursor-pointer hover:text-white" />
          </div>
        </div>

        {/* Message Thread Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F7F8F6]">
          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"} items-end gap-2`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-2xs text-base leading-relaxed ${
                    isUser
                      ? "bg-[#F0FDF4] text-[#12181A] border border-[#1E5128]/20 rounded-br-xs"
                      : "bg-white text-[#12181A] rounded-bl-xs border border-[#E5E8E6]"
                  }`}
                >
                  {msg.imageUrl && (
                    <div className="mb-3 rounded-xl overflow-hidden border border-[#E5E8E6]">
                      <img src={msg.imageUrl} alt="Uploaded scrap" className="w-full max-h-52 object-cover" />
                    </div>
                  )}

                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  <div className="flex items-center justify-end gap-1.5 text-xs text-[#8A93A0] mt-2">
                    <span>{msg.timestamp}</span>
                    {isUser && <CheckCheck className="w-4 h-4 text-[#1E5128]" />}
                  </div>
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex justify-start items-center gap-2">
              <div className="bg-white rounded-2xl px-5 py-3 text-sm text-[#4B5563] border border-[#E5E8E6] flex items-center gap-2.5 shadow-2xs">
                <Sparkles className="w-4 h-4 text-[#1E5128] animate-spin" />
                <span>EcoKabadi AI is analyzing scrap rate...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Scrap Preset Scans */}
        <div className="bg-white border-t border-[#E5E8E6] px-4 py-2.5 flex items-center gap-2 overflow-x-auto text-xs no-scrollbar">
          <span className="text-xs text-[#8A93A0] shrink-0 font-medium mr-1">Test Photos:</span>
          {MATERIALS_DATA.slice(0, 4).map((m) => (
            <button
              key={m.key}
              onClick={() => handleSendSamplePhoto(m)}
              disabled={isLoading}
              className="min-h-[44px] bg-white hover:bg-[#F7F8F6] text-[#12181A] border border-[#E5E8E6] px-3.5 py-2 rounded-xl shrink-0 text-sm flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ImageIcon className="w-4 h-4 text-[#1E5128]" />
              {m.name.en}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendMessage} className="bg-white px-4 py-3 flex items-center gap-3 border-t border-[#E5E8E6]">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 text-[#4B5563] hover:text-[#12181A] rounded-xl hover:bg-[#F7F8F6] transition-colors cursor-pointer"
            title="Attach Scrap Photo"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleCustomFileUpload}
            accept="image/*"
            className="hidden"
          />

          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder={
              language === "hi"
                ? "संदेश लिखें (उदा. कॉपर का भाव? या 1 दबाएं)..."
                : "Type message or scrap question (e.g. Copper price?)..."
            }
            className="flex-1 min-h-[44px] bg-white border border-[#E5E8E6] rounded-xl px-4 py-2.5 text-base text-[#12181A] placeholder:text-[#8A93A0] focus:outline-none focus:border-[#1E5128]"
          />

          <button
            type="submit"
            disabled={!inputVal.trim() || isLoading}
            className="min-h-[44px] min-w-[44px] bg-[#1E5128] hover:bg-[#163e1f] disabled:opacity-50 text-white p-3 rounded-xl transition-all shadow-xs flex items-center justify-center cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
