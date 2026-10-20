// question.js - Xử lý câu hỏi
const QuestionManager = {
    currentQuestions: [],

    setQuestions(questions, count) {
        // Xáo trộn và lấy số lượng câu hỏi ngẫu nhiên
        const shuffled = [...questions].sort(() => 0.5 - Math.random());
        this.currentQuestions = shuffled.slice(0, count);
    },

    loadQuestion(index) {
        if (index >= this.currentQuestions.length) return null;
        
        const questionData = this.currentQuestions[index];
        
        // Cập nhật UI hiển thị
        document.querySelector('.mission').textContent = `NHIỆM VỤ: 0${index + 1}`;
        document.querySelector('.prompt-text').textContent = `"${questionData.question}"`;
        
        // Render các khối tinh thể (từ khóa) bằng KeywordManager
        KeywordManager.renderKeywords(questionData.keywords);
        
        return questionData;
    }
};

