/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Lock,
  ArrowRight,
  RotateCcw,
  Lightbulb,
  Send,
  Award,
  HelpCircle,
  FileEdit,
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  Compass,
  GraduationCap,
  AlertCircle,
  MessageSquare
} from 'lucide-react';

interface Step {
  stepNumber: number;
  title: string;
  objective: string;
}

interface SocraticAnalysis {
  subject: string;
  topic: string;
  difficulty: string;
  analysis: string;
  steps: Step[];
  firstStepQuestion: string;
  gentleHint: string;
  encouragement: string;
}

interface Message {
  id: string;
  role: 'bot' | 'student';
  content: string;
  feedback?: string;
  isOnTrack?: boolean;
  stepNumber?: number;
  gentleHint?: string;
  timestamp: string;
}

interface SessionRecord {
  id: string;
  question: string;
  subject: string;
  topic: string;
  date: string;
  completed: boolean;
  stepsCount: number;
}

const SAMPLE_QUESTIONS = [
  {
    subject: 'Toán học',
    topic: 'Phương trình bậc hai',
    question: 'Giải phương trình bậc hai $2x^2 - 5x + 2 = 0$ và giải thích vì sao phương trình này có hai nghiệm phân biệt.',
    tag: 'Đại số 9',
  },
  {
    subject: 'Vật lý',
    topic: 'Rơi tự do & Chuyển động',
    question: 'Một viên bi được thả rơi tự do từ đỉnh tháp cao 45m. Bỏ qua sức cản không khí, lấy g = 10 m/s². Tính thời gian để viên bi chạm đất và vận tốc của nó tại thời điểm chạm đất.',
    tag: 'Vật lý 10',
  },
  {
    subject: 'Ngữ văn',
    topic: 'Phân tích nhân vật',
    question: 'Phân tích diễn biến tâm trạng của nhân vật Tràng trong truyện ngắn "Vợ nhặt" (Kim Lân) vào buổi sáng đầu tiên sau ngày đưa người vợ nhặt về nhà.',
    tag: 'Văn học 12',
  },
  {
    subject: 'Hóa học',
    topic: 'Phản ứng khí & Dung dịch kiềm',
    question: 'Dẫn từ từ khí CO2 vào dung dịch chứa Ca(OH)2 cho đến dư. Hiện tượng quan sát được qua từng giai đoạn là gì và vì sao lại như vậy?',
    tag: 'Hóa học vô cơ',
  },
  {
    subject: 'Triết học',
    topic: 'Đạo đức học & Tình huống tiến thoái lưỡng nan',
    question: 'Trong bài toán xe điện (Trolley Problem), một đoàn tàu sắp đâm vào 5 người. Nếu gạt cần, tàu sẽ chuyển sang làn phụ và chỉ đâm 1 người. Theo các góc nhìn đạo đức học, quyết định nào được coi là đúng đắn?',
    tag: 'Đạo đức học',
  },
  {
    subject: 'Tin học',
    topic: 'Thuật toán & Cấu trúc dữ liệu',
    question: 'Làm thế nào để kiểm tra xem một chuỗi ký tự bất kỳ có phải là chuỗi Palindrome (chuỗi đối xứng, đọc xuôi ngược như nhau) với độ phức tạp tối ưu nhất?',
    tag: 'Thuật toán',
  },
];

export default function App() {
  const [questionInput, setQuestionInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  
  // Active session states
  const [analysis, setAnalysis] = useState<SocraticAnalysis | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [studentInput, setStudentInput] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionCompleted, setSessionCompleted] = useState(false);
  const [completionSummary, setCompletionSummary] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [currentHint, setCurrentHint] = useState<string>('');
  
  // Scratchpad
  const [scratchpad, setScratchpad] = useState<string>(() => {
    return localStorage.getItem('socratic_scratchpad') || '';
  });
  const [showScratchpad, setShowScratchpad] = useState(false);
  
  // History
  const [history, setHistory] = useState<SessionRecord[]>(() => {
    try {
      const saved = localStorage.getItem('socratic_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // UI helpers
  const [showOriginalQuestion, setShowOriginalQuestion] = useState(true);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('socratic_scratchpad', scratchpad);
  }, [scratchpad]);

  useEffect(() => {
    localStorage.setItem('socratic_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSubmitting, sessionCompleted]);

  // Start new Socratic journey
  const handleStartSession = async (presetQuestion?: string) => {
    const q = presetQuestion || questionInput;
    if (!q.trim()) return;

    setIsStarting(true);
    setAnalysis(null);
    setMessages([]);
    setCurrentStepIndex(0);
    setSessionCompleted(false);
    setCompletionSummary('');
    setShowHint(false);

    try {
      const res = await fetch('/api/socratic/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.trim() }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Lỗi máy chủ (${res.status})`);
      }

      const data: SocraticAnalysis = await res.json();
      setAnalysis(data);
      setCurrentHint(data.gentleHint || '');

      // Initial bot message: greeting + Socratic Question for Step 1
      const initialMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'bot',
        content: data.firstStepQuestion,
        feedback: data.encouragement,
        isOnTrack: undefined,
        stepNumber: 1,
        gentleHint: data.gentleHint,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages([initialMessage]);

      // Add to session history
      const newRecord: SessionRecord = {
        id: `sess-${Date.now()}`,
        question: q.trim(),
        subject: data.subject || 'Tổng hợp',
        topic: data.topic || 'Kiến thức chung',
        date: new Date().toLocaleDateString('vi-VN'),
        completed: false,
        stepsCount: data.steps?.length || 3,
      };
      setHistory(prev => [newRecord, ...prev.slice(0, 19)]);
    } catch (err: any) {
      alert(`Không thể khởi động Socratic AI: ${err.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  // Submit student response or hint request
  const handleSubmitResponse = async (isHintOnly: boolean = false) => {
    if (!analysis) return;
    if (!isHintOnly && !studentInput.trim()) return;

    const answerText = isHintOnly
      ? 'Thầy Socrates ơi, em đang băn khoăn ở chỗ này, thầy có thể gợi ý nhỏ cho em hướng đi được không?'
      : studentInput.trim();

    // Append student message
    const studentMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'student',
      content: answerText,
      stepNumber: currentStepIndex + 1,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, studentMsg];
    setMessages(updatedMessages);
    setStudentInput('');
    setIsSubmitting(true);
    setShowHint(false);

    try {
      const res = await fetch('/api/socratic/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalQuestion: questionInput || analysis.topic,
          currentStepIndex,
          steps: analysis.steps,
          history: updatedMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          studentAnswer: answerText,
          isHintRequest: isHintOnly,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Lỗi máy chủ (${res.status})`);
      }

      const evalData = await res.json();
      const { status, isOnTrack, feedback, socraticQuestion, gentleHint, summaryIfCompleted } = evalData;

      if (gentleHint) {
        setCurrentHint(gentleHint);
      }

      // Check step advancement
      if (status === 'completed') {
        setSessionCompleted(true);
        setCompletionSummary(summaryIfCompleted || feedback);

        const botMsg: Message = {
          id: `msg-${Date.now() + 1}`,
          role: 'bot',
          content: 'Chúc mừng bạn! Bạn đã tự mình chinh phục toàn bộ các bước tư duy!',
          feedback: feedback,
          isOnTrack: true,
          stepNumber: analysis.steps.length,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, botMsg]);

        // Update history completion status
        setHistory(prev =>
          prev.map((rec, i) => (i === 0 ? { ...rec, completed: true } : rec))
        );
      } else if (status === 'next_step') {
        const nextIdx = currentStepIndex + 1;
        setCurrentStepIndex(nextIdx);

        const botMsg: Message = {
          id: `msg-${Date.now() + 1}`,
          role: 'bot',
          content: socraticQuestion,
          feedback: feedback,
          isOnTrack: true,
          stepNumber: nextIdx + 1,
          gentleHint: gentleHint,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        // Status is 'retry' - remain on current step!
        const botMsg: Message = {
          id: `msg-${Date.now() + 1}`,
          role: 'bot',
          content: socraticQuestion,
          feedback: feedback,
          isOnTrack: isOnTrack || false,
          stepNumber: currentStepIndex + 1,
          gentleHint: gentleHint,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, botMsg]);
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'bot',
        content: `Đã có trục trặc nhỏ: ${err.message}. Xin bạn hãy thử gửi lại câu trả lời nhé!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setAnalysis(null);
    setMessages([]);
    setQuestionInput('');
    setCurrentStepIndex(0);
    setSessionCompleted(false);
    setCompletionSummary('');
    setShowHint(false);
  };

  const filteredQuestions = selectedCategory === 'Tất cả'
    ? SAMPLE_QUESTIONS
    : SAMPLE_QUESTIONS.filter(q => q.subject === selectedCategory);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                Socratic AI
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Phương Pháp Vấn Đáp
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Không giải hộ bài • Chia nhỏ vấn đề • Tự mình làm chủ tri thức
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Scratchpad Button */}
          <button
            onClick={() => setShowScratchpad(!showScratchpad)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-all ${
              showScratchpad
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300'
            }`}
            title="Mở bảng nháp ghi chú ý tưởng"
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Bảng nháp</span>
          </button>

          {analysis && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Đề bài mới</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* If NO active session: Show Introduction & Problem Input Screen */}
        {!analysis && (
          <div className="max-w-4xl mx-auto w-full flex flex-col gap-8 py-2">
            {/* Core Socratic Philosophy Banner */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-b from-slate-900 to-slate-900/60 p-6 sm:p-8 shadow-2xl shadow-black/50">
              <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col gap-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold w-fit">
                  <Compass className="w-3.5 h-3.5" />
                  Triết lý giáo dục Socrates (Maiêutikê)
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                  "Giáo dục không phải là đổ đầy một chiếc bình, mà là thắp lên một ngọn lửa."
                </h2>

                <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-3xl">
                  Socratic AI <span className="text-amber-400 font-semibold">tuyệt đối không giải sẵn bài</span> cho bạn. Thay vào đó, AI sẽ đóng vai người thầy Socrates uyên bác: phân tích dạng bài, chia nhỏ vấn đề thành các bước tư duy, và chỉ đặt câu hỏi gợi mở cho bước đầu tiên để bạn tự mình khám phá ra chân lý.
                </p>

                {/* 4 Core Pillars of Socratic AI */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <span className="text-xs font-semibold text-slate-200">Phân tích dạng bài</span>
                    <span className="text-[11px] text-slate-400">Xác định môn học, chủ đề & kiến thức trọng tâm.</span>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <span className="text-xs font-semibold text-slate-200">Chia nhỏ vấn đề</span>
                    <span className="text-[11px] text-slate-400">Tạo lộ trình các nấc thang tư duy cơ bản.</span>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <span className="text-xs font-semibold text-slate-200">Hỏi mở Bước 1</span>
                    <span className="text-[11px] text-slate-400">Chỉ hỏi gợi mở cho bước 1 để bạn tự tư duy trước.</span>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center font-bold text-xs">
                      4
                    </div>
                    <span className="text-xs font-semibold text-slate-200">Đúng mới chuyển bước</span>
                    <span className="text-[11px] text-slate-400">Chỉ khi trả lời đúng hướng mới mở nấc thang tiếp theo.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Input Question Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-amber-400" />
                  Nhập đề bài hoặc vấn đề bạn muốn được dẫn dắt:
                </label>
                <span className="text-xs text-slate-500">Toán, Lý, Hóa, Văn, Sử, Triết học, Tin học...</span>
              </div>

              <div className="relative">
                <textarea
                  value={questionInput}
                  onChange={e => setQuestionInput(e.target.value)}
                  placeholder="Ví dụ: 'Giải phương trình 2x^2 - 5x + 2 = 0', hoặc 'Phân tích tâm lý nhân vật Tràng trong Vợ nhặt', hoặc 'Tại sao thả một hòn đá rơi từ độ cao 20m thì nó rơi nhanh dần?'..."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 rounded-xl p-4 text-sm text-slate-100 placeholder:text-slate-600 outline-none transition-all resize-y"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <p className="text-xs text-slate-500 italic">
                  💡 Nhắc nhở: Socratic AI sẽ không giải bài thay bạn, hãy sẵn sàng động não!
                </p>

                <button
                  onClick={() => handleStartSession()}
                  disabled={!questionInput.trim() || isStarting}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isStarting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      <span>Socrates đang phân tích...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Bắt đầu Khám phá Tư duy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Presets by Subject */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  Hoặc chọn bài mẫu để trải nghiệm nhanh:
                </h3>

                {/* Filter tags */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  {['Tất cả', 'Toán học', 'Vật lý', 'Ngữ văn', 'Hóa học', 'Triết học', 'Tin học'].map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-amber-500/20 text-amber-300 font-medium border border-amber-500/40'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredQuestions.map((preset, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setQuestionInput(preset.question);
                      handleStartSession(preset.question);
                    }}
                    className="p-4 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer group flex flex-col justify-between gap-3 shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-800 text-amber-400 border border-slate-700">
                          {preset.subject} • {preset.tag}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-xs sm:text-sm text-slate-200 font-medium line-clamp-2">
                        {preset.question}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-500 group-hover:text-slate-400">
                      Chủ đề: {preset.topic}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* If ACTIVE session: Show Problem Breakdown, Scaffolding Roadmap & Chat Interface */}
        {analysis && (
          <div className="flex flex-col gap-6">
            {/* Top Overview & Subject Analysis Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-xs">
                    {analysis.subject}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 font-medium text-xs">
                    {analysis.topic}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-medium text-xs">
                    Mức độ: {analysis.difficulty}
                  </span>
                </div>

                <button
                  onClick={() => setShowOriginalQuestion(!showOriginalQuestion)}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  {showOriginalQuestion ? 'Thu gọn đề bài' : 'Xem lại đề bài'}
                  {showOriginalQuestion ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showOriginalQuestion && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs sm:text-sm text-slate-200 leading-relaxed">
                  <span className="font-semibold text-amber-400 block mb-1">Đề bài đang giải:</span>
                  {questionInput}
                </div>
              )}

              {/* Analysis by Socratic AI */}
              <div className="text-xs text-slate-300 bg-slate-950/40 p-3 rounded-xl border border-slate-800/50 flex items-start gap-2.5">
                <Compass className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-200">Góc nhìn sư phạm: </span>
                  {analysis.analysis}
                </div>
              </div>
            </div>

            {/* Socratic Scaffolding Steps Progress Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Lộ trình nấc thang tư duy ({currentStepIndex + 1}/{analysis.steps.length})
                  </h3>
                </div>

                <span className="text-xs text-amber-400 font-semibold">
                  {sessionCompleted ? '100% Hoàn thành' : `Đang ở nấc thang ${currentStepIndex + 1}`}
                </span>
              </div>

              {/* Steps Visual Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                {analysis.steps.map((step, idx) => {
                  const isDone = sessionCompleted || idx < currentStepIndex;
                  const isCurrent = !sessionCompleted && idx === currentStepIndex;
                  const isLocked = !sessionCompleted && idx > currentStepIndex;

                  return (
                    <div
                      key={idx}
                      className={`relative p-3 rounded-xl border transition-all flex flex-col justify-between gap-1.5 ${
                        isDone
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                          : isCurrent
                          ? 'bg-amber-950/30 border-amber-500/60 text-amber-100 shadow-md shadow-amber-500/10 ring-1 ring-amber-500/30'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-500 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider">
                          Bước {step.stepNumber}
                        </span>

                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : isCurrent ? (
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                          </span>
                        ) : (
                          <Lock className="w-3 h-3 text-slate-600" />
                        )}
                      </div>

                      <div className="text-xs font-semibold line-clamp-1">
                        {step.title}
                      </div>

                      <div className="text-[10px] line-clamp-2 text-slate-400">
                        {isLocked ? 'Đang khóa để bạn tự suy nghĩ bước trước...' : step.objective}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Socratic Dialogue / Chat Area */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col shadow-2xl overflow-hidden min-h-[480px]">
              {/* Chat Messages Stream */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto flex flex-col gap-5 max-h-[560px]">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex flex-col gap-2 max-w-3xl ${
                      msg.role === 'student' ? 'ml-auto items-end' : 'mr-auto items-start'
                    }`}
                  >
                    {/* Role Header */}
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {msg.role === 'bot' ? (
                        <>
                          <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center font-bold text-[10px]">
                            Σ
                          </div>
                          <span className="font-semibold text-amber-400">Người thầy Socrates</span>
                          {msg.stepNumber && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                              Bước {msg.stepNumber}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-slate-300">Bạn (Học sinh)</span>
                          <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                        </>
                      )}
                    </div>

                    {/* Feedback Alert if onTrack or need guidance */}
                    {msg.feedback && (
                      <div
                        className={`text-xs p-3 rounded-xl border w-full flex items-start gap-2 ${
                          msg.isOnTrack === true
                            ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                            : msg.isOnTrack === false
                            ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                            : 'bg-slate-800/60 border-slate-700 text-slate-300'
                        }`}
                      >
                        {msg.isOnTrack === true ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : msg.isOnTrack === false ? (
                          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <div className="leading-relaxed">
                          <span className="font-bold block mb-0.5">
                            {msg.isOnTrack === true
                              ? 'Rất xuất sắc! Nhận định đúng hướng:'
                              : msg.isOnTrack === false
                              ? 'Chưa chính xác nhưng đừng nản lòng!'
                              : 'Lời chào từ Socrates:'}
                          </span>
                          {msg.feedback}
                        </div>
                      </div>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`p-4 rounded-2xl text-sm leading-relaxed ${
                        msg.role === 'student'
                          ? 'bg-amber-500 text-slate-950 font-medium rounded-tr-none shadow-md'
                          : 'bg-slate-950 border border-slate-800/90 text-slate-100 rounded-tl-none shadow-inner'
                      }`}
                    >
                      {msg.role === 'bot' && (
                        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          Câu hỏi gợi mở của Socrates:
                        </div>
                      )}
                      <p className="whitespace-pre-line text-sm sm:text-base">
                        {msg.content}
                      </p>
                    </div>

                    {/* Gentle Hint trigger button for this step */}
                    {msg.role === 'bot' && msg.gentleHint && !sessionCompleted && (
                      <div className="w-full">
                        <button
                          onClick={() => {
                            setCurrentHint(msg.gentleHint || '');
                            setShowHint(!showHint);
                          }}
                          className="text-[11px] text-amber-400/80 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Lightbulb className="w-3 h-3" />
                          <span>{showHint ? 'Ẩn manh mối gợi ý' : 'Cần manh mối nhỏ? Bấm vào đây'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Submitting Loading Indicator */}
                {isSubmitting && (
                  <div className="mr-auto max-w-md p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-3 text-xs text-slate-400">
                    <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span>Socrates đang đọc suy nghĩ của bạn và chuẩn bị phản hồi...</span>
                  </div>
                )}

                {/* Collapsible Hint Drawer */}
                {showHint && currentHint && (
                  <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 animate-fadeIn">
                    <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <span className="font-bold block text-amber-300 mb-0.5">Manh mối tư duy (Không phải đáp án):</span>
                      <p className="leading-relaxed">{currentHint}</p>
                    </div>
                  </div>
                )}

                {/* Celebration Card when All Steps are Completed */}
                {sessionCompleted && (
                  <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/50 flex flex-col items-center text-center gap-4 my-2 shadow-2xl">
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/20 animate-bounce">
                      <Award className="w-8 h-8" />
                    </div>

                    <div>
                      <h4 className="text-xl font-bold text-white tracking-tight">
                        Chúc Mừng Nhà Tư Tưởng Độc Lập!
                      </h4>
                      <p className="text-xs text-amber-300 mt-1">
                        Bạn đã tự mình giải quyết bài toán qua từng bước mà không cần ai làm hộ.
                      </p>
                    </div>

                    {completionSummary && (
                      <div className="w-full text-left bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed">
                        <span className="font-bold text-amber-400 block mb-1">
                          Tổng kết chân lý do chính bạn khám phá ra:
                        </span>
                        <p className="whitespace-pre-line">{completionSummary}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={handleReset}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-bold text-xs sm:text-sm shadow-md hover:from-amber-400 hover:to-yellow-400 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-4 h-4" />
                        Khám phá bài toán khác
                      </button>
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Student Response Input Bar */}
              {!sessionCompleted && (
                <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-col gap-2.5">
                  {/* Quick Action Helper Chips */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    <button
                      onClick={() => handleSubmitResponse(true)}
                      disabled={isSubmitting}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[11px] flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                    >
                      <HelpCircle className="w-3 h-3 text-amber-400" />
                      Em chưa hiểu rõ, xin thầy gợi ý nhỏ
                    </button>

                    <button
                      onClick={() => setStudentInput(prev => prev + ' Theo em hiểu thì công thức/quy luật ở đây là...')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-[11px] shrink-0 transition-colors cursor-pointer"
                    >
                      "Theo em hiểu thì..."
                    </button>

                    <button
                      onClick={() => setStudentInput(prev => prev + ' Em phát hiện ra điểm mấu chốt là: ')}
                      className="px-2.5 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-[11px] shrink-0 transition-colors cursor-pointer"
                    >
                      "Điểm mấu chốt là..."
                    </button>
                  </div>

                  {/* Input form */}
                  <div className="flex items-end gap-2">
                    <textarea
                      value={studentInput}
                      onChange={e => setStudentInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitResponse(false);
                        }
                      }}
                      placeholder={`Trả lời cho Bước ${currentStepIndex + 1}: Hãy viết suy nghĩ, lập luận hoặc công thức của bạn... (Enter để gửi)`}
                      rows={2}
                      disabled={isSubmitting}
                      className="flex-1 bg-slate-900 border border-slate-800 focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40 rounded-xl p-3 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all resize-none"
                    />

                    <button
                      onClick={() => handleSubmitResponse(false)}
                      disabled={!studentInput.trim() || isSubmitting}
                      className="px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer h-[54px]"
                      title="Gửi câu trả lời cho Socrates"
                    >
                      <Send className="w-4 h-4" />
                      <span className="hidden sm:inline">Gửi</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span>💡 Socrates sẽ chỉ chuyển bước khi câu trả lời của bạn đi đúng hướng.</span>
                    <span>Phím tắt: Enter để gửi</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Scratchpad Drawer */}
      {showScratchpad && (
        <div className="fixed bottom-4 right-4 z-40 w-80 sm:w-96 bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slideUp">
          <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <FileEdit className="w-4 h-4" />
              <span>Góc nháp tư duy của bạn</span>
            </div>
            <button
              onClick={() => setShowScratchpad(false)}
              className="text-slate-400 hover:text-slate-200 text-xs px-2 py-0.5 rounded cursor-pointer"
            >
              ✕
            </button>
          </div>
          <div className="p-3">
            <textarea
              value={scratchpad}
              onChange={e => setScratchpad(e.target.value)}
              placeholder="Ghi nhanh công thức, biến số, ý tưởng nháp tại đây (tự động lưu)..."
              rows={6}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:border-amber-500/50 resize-none"
            />
          </div>
          <div className="px-3 pb-2.5 flex justify-between items-center text-[10px] text-slate-500">
            <span>Dữ liệu nháp lưu trên trình duyệt</span>
            <button
              onClick={() => setScratchpad('')}
              className="text-red-400 hover:text-red-300"
            >
              Xóa bảng nháp
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-4 text-center text-xs text-slate-500 mt-auto">
        <p>
          Socratic AI • Trợ lý giáo dục vấn đáp Socrates • Giúp học sinh tư duy sâu và tự tin làm chủ bài học
        </p>
      </footer>
    </div>
  );
}
