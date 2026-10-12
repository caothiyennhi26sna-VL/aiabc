import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Server-side Gemini client initialization with mandatory telemetry header
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Endpoint: Analyze question, decompose into scaffolding steps, and formulate Step 1 Socratic Question
app.post('/api/socratic/start', async (req, res) => {
  try {
    const { question, subjectHint } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'Vui lòng cung cấp câu hỏi hoặc đề bài học tập.' });
    }

    const ai = getGeminiClient();

    const systemInstruction = `
Bạn là 'Socratic AI' - một người thầy giáo dục thông minh, uyên bác và giàu lòng tận tụy, đại diện cho phương pháp giáo dục vấn đáp Socrates (Socratic Method / Maiêutikê).

NHIỆM VỤ CỐT LÕI VÀ NGUYÊN TẮC BẤT DI BẤT DỊCH:
1. TUYỆT ĐỐI KHÔNG làm hộ bài hay giải sẵn đề bài cho học sinh.
2. TUYỆT ĐỐI KHÔNG cung cấp đáp số hoặc đáp án cuối cùng.
3. Khi học sinh gửi một câu hỏi (Toán học, Vật lý, Hóa học, Ngữ văn, Lịch sử, Địa lý, Sinh học, Triết học, Tin học / Lập trình, Tiếng Anh...):
   - Phân tích câu hỏi: xác định môn học, chủ đề/dạng bài, mức độ, kiến thức trọng tâm.
   - Chia nhỏ vấn đề thành 3 đến 5 bước tư duy cơ bản (scaffolding steps). 
     LƯU Ý: Tiêu đề và mục tiêu của các bước chỉ nêu định hướng tư duy (ví dụ: 'Bước 1: Xác định giả thiết & công thức liên quan', 'Bước 2: Tìm mối liên hệ đại lượng', 'Bước 3: Thực hiện tính toán/lập luận'), KHÔNG TIẾT LỘ LỜI GIẢI hay đáp án trong các bước này!
   - ĐẶT DUY NHẤT 1 CÂU HỎI GỢI MỞ CHO BƯỚC ĐẦU TIÊN (Bước 1). Câu hỏi phải khơi gợi để học sinh tự suy nghĩ và trả lời trước.
   - Giọng điệu: Thân thiện, tôn trọng học sinh, kích thích trí tò mò, mang phong thái một người thầy thông thái.
`;

    const prompt = `
Đề bài/Câu hỏi của học sinh:
"""
${question.trim()}
"""
${subjectHint ? `Gợi ý lĩnh vực bổ sung: ${subjectHint}` : ''}

Hãy phân tích bài học, chia nhỏ thành các bước giải quyết và đặt câu hỏi gợi mở Socratic đầu tiên cho Bước 1. Trả lời bằng tiếng Việt chuẩn mực sư phạm.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING, description: 'Tên môn học (vd: Toán học, Ngữ văn, Vật lý, Hóa học...)' },
            topic: { type: Type.STRING, description: 'Dạng bài hoặc chủ đề kiến thức (vd: Phương trình bậc hai, Phân tích nhân vật, Định luật Newton...)' },
            difficulty: { type: Type.STRING, description: 'Mức độ nhận thức (Nhận biết, Thông hiểu, Vận dụng, Vận dụng cao)' },
            analysis: { type: Type.STRING, description: 'Phân tích tổng quan ngắn gọn về bản chất vấn đề và kiến thức trọng tâm' },
            steps: {
              type: Type.ARRAY,
              description: 'Danh sách 3-5 bước tư duy tuần tự (không tiết lộ lời giải)',
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING, description: 'Tên ngắn gọn của bước' },
                  objective: { type: Type.STRING, description: 'Mục tiêu tư duy của học sinh trong bước này' }
                },
                required: ['stepNumber', 'title', 'objective']
              }
            },
            firstStepQuestion: { type: Type.STRING, description: 'Câu hỏi gợi mở Socratic dành riêng cho Bước 1 để học sinh tự suy nghĩ và trả lời' },
            gentleHint: { type: Type.STRING, description: 'Gợi ý phụ nhẹ nhàng mang tính định hướng nếu học sinh chưa biết bắt đầu từ đâu' },
            encouragement: { type: Type.STRING, description: 'Lời chào khích lệ tinh thần tự học của người thầy Socrates' }
          },
          required: ['subject', 'topic', 'difficulty', 'analysis', 'steps', 'firstStepQuestion', 'gentleHint', 'encouragement']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/socratic/start:', error);
    return res.status(500).json({
      error: error?.message || 'Không thể phân tích câu hỏi lúc này. Vui lòng kiểm tra API key hoặc thử lại.',
    });
  }
});

// Endpoint: Evaluate student's answer, decide whether to advance to next step or guide further
app.post('/api/socratic/step', async (req, res) => {
  try {
    const {
      originalQuestion,
      currentStepIndex,
      steps,
      history,
      studentAnswer,
      isHintRequest,
    } = req.body;

    if (!originalQuestion || typeof currentStepIndex !== 'number' || !Array.isArray(steps)) {
      return res.status(400).json({ error: 'Dữ liệu phiên học không hợp lệ.' });
    }

    const ai = getGeminiClient();
    const currentStep = steps[currentStepIndex] || steps[0];
    const isLastStep = currentStepIndex >= steps.length - 1;

    const systemInstruction = `
Bạn là 'Socratic AI', người thầy sư phạm đang theo dõi quá trình tự giải quyết vấn đề của học sinh.
Triết lý hành động:
- KHÔNG BAO GIỜ giải hộ bài hay viết sẵn đáp án.
- Nhiệm vụ của bạn là xem xét câu trả lời/suy nghĩ của học sinh đối với câu hỏi ở bước hiện tại.
- BƯỚC HIỆN TẠI LÀ: Bước ${currentStep.stepNumber}: "${currentStep.title}" (Mục tiêu: "${currentStep.objective}").
- Đây có phải bước cuối cùng của bài không: ${isLastStep ? 'ĐÚNG (Bước cuối)' : 'CHƯA (Còn các bước tiếp theo)'}.

QUY TẮC PHÁN QUYẾT:
1. NẾU HỌC SINH TRẢ LỜI ĐÚNG HƯỚNG HOẶC ĐẠT ĐƯỢC MỤC TIÊU CỦA BƯỚC NÀY:
   - status: "${isLastStep ? 'completed' : 'next_step'}"
   - isOnTrack: true
   - feedback: Khen ngợi nỗ lực và khẳng định tại sao suy nghĩ của học sinh là chính xác, củng cố sự tự tin.
   - ${isLastStep 
       ? 'socraticQuestion: Để trống hoặc lời tổng kết chúc mừng.' 
       : 'socraticQuestion: Đặt câu hỏi gợi mở tiếp theo cho bước kế tiếp (Bước ' + (currentStepIndex + 2) + ').'
     }
   - summaryIfCompleted: ${isLastStep ? 'Bản đúc kết ngắn gọn, sâu sắc về toàn bộ kiến thức và bài học mà CHÍNH HỌC SINH vừa tự mình khám phá thành công!' : 'Trống'}

2. NẾU HỌC SINH TRẢ LỜI SAI HƯỚNG, CHƯA ĐẦY ĐỦ, HOẶC BẢO "EM CHƯA BIẾT / CHƯA HIỂU / XIN GỢI Ý":
   - status: "retry"
   - isOnTrack: false
   - TUYỆT ĐỐI KHÔNG CHUYỂN BƯỚC VÀ KHÔNG NÓI ĐÁP ÁN!
   - feedback: Động viên, chỉ ra điểm mấu chốt hoặc điểm thú vị trong suy nghĩ chưa trọn vẹn của học sinh một cách tế nhị, ân cần.
   - socraticQuestion: Đặt một câu hỏi phụ nhỏ hơn (micro-question), đưa ra một ví dụ tương tự gần gũi (analogy) hoặc lật ngược vấn đề để học sinh tự phát hiện ra lỗi sai và tự điều chỉnh.
   - gentleHint: Cung cấp một gợi ý định hướng nhỏ.
`;

    const recentHistory = (history || [])
      .slice(-6)
      .map((h: any) => `${h.role === 'student' ? 'Học sinh' : 'Socratic AI'}: ${h.content}`)
      .join('\n');

    const prompt = `
Đề bài gốc:
"""
${originalQuestion}
"""

Lộ trình các bước:
${steps.map((s: any, idx: number) => `Bước ${idx + 1}: ${s.title} (Mục tiêu: ${s.objective})`).join('\n')}

Bước đang thực hiện: Bước ${currentStepIndex + 1} (${currentStep.title})
Học sinh yêu cầu gợi ý: ${isHintRequest ? 'CÓ' : 'KHÔNG'}

Lịch sử trao đổi gần nhất:
${recentHistory}

Câu trả lời / phản hồi mới nhất của học sinh:
"""
${studentAnswer || (isHintRequest ? 'Em đang phân vân, thầy/cô có thể gợi ý nhỏ cho em không?' : '')}
"""

Hãy đánh giá xem học sinh đã trả lời đúng hướng cho bước này chưa và phản hồi theo đúng phương pháp Socratic.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: {
              type: Type.STRING,
              description: "Một trong các giá trị: 'next_step' (đạt bước, qua bước mới), 'retry' (chưa đạt, tiếp tục bước hiện tại), 'completed' (đã xong bước cuối)"
            },
            isOnTrack: { type: Type.BOOLEAN, description: 'True nếu câu trả lời đúng hướng hoặc chấp nhận được' },
            feedback: { type: Type.STRING, description: 'Lời nhận xét của Socrates: giải thích, khen ngợi hoặc chỉnh hướng tế nhị' },
            socraticQuestion: { type: Type.STRING, description: 'Câu hỏi gợi mở tiếp theo (nếu chuyển bước) hoặc câu hỏi nhỏ bổ trợ (nếu retry)' },
            gentleHint: { type: Type.STRING, description: 'Gợi ý nhẹ nhàng nếu cần' },
            summaryIfCompleted: { type: Type.STRING, description: 'Tổng kết kiến thức học sinh đã tự khám phá ra nếu hoàn thành bài (ngược lại để trống)' }
          },
          required: ['status', 'isOnTrack', 'feedback', 'socraticQuestion', 'gentleHint']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/socratic/step:', error);
    return res.status(500).json({
      error: error?.message || 'Không thể đánh giá câu trả lời lúc này. Vui lòng thử lại.',
    });
  }
});

// Vite middlewares integration in dev mode or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Socratic AI server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
