
require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const prompts = {
  notes: `Create excellent textbook-quality study notes.
Use a suitable structure:
1. Chapter title and introduction
2. Main headings and subheadings
3. Detailed concept explanations
4. Important definitions
5. Examples
6. Formulas and equations, if present
7. Important facts
8. Comparisons, if relevant
9. Questions and answers
10. Quick revision
11. Key takeaways

Preserve important information. Do not invent facts.
Mark unclear source information as "Unclear in source".
Use readable Markdown and explain difficult concepts simply.`,

  summary: `Create a complete chapter summary with overview,
main ideas, definitions, examples, key facts and revision points.
Do not omit essential concepts.`,

  quiz: `Create exactly 10 multiple-choice questions.
Each question must have four options A, B, C and D.
Provide the correct answer and a short explanation.
Use a mixture of easy, medium and challenging questions.
Do not ask about information absent from the source.`,

  flashcards: `Create 12 useful flashcards.
Use FRONT: for the question and BACK: for the answer.
Cover the most important concepts. Avoid duplicates.`,

  explain: `Act as a patient teacher.
Explain the material step by step in simple language.
Use relatable examples and explain difficult terms.
Finish with a short recap.`,

  revision: `Create a last-minute revision sheet with important
definitions, key facts, formulas, dates, names, common mistakes,
10 revision questions and a final checklist.`,

  question: `Answer the student's question accurately using the
provided material. Explain the reasoning simply. If the source
does not contain the answer, clearly say so.`
};

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: "3.0" });
});

app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === "YOUR_NEW_API_KEY") {
      return res.status(500).json({
        error: "Add your new API key to the .env file."
      });
    }

    const {
      notes,
      task,
      question,
      language = "same",
      length = "detailed"
    } = req.body || {};

    if (typeof notes !== "string" || !notes.trim()) {
      return res.status(400).json({ error: "Study material is required." });
    }

    if (notes.length > 30000) {
      return res.status(413).json({ error: "Maximum 30,000 characters allowed." });
    }

    if (!prompts[task]) {
      return res.status(400).json({ error: "Invalid study mode." });
    }

    if (task === "question" && !String(question || "").trim()) {
      return res.status(400).json({ error: "Enter your question." });
    }

    const languages = {
      same: "Use the same language as the source material.",
      English: "Write in English.",
      Hindi: "Write in Hindi using Devanagari script.",
      Hinglish: "Write in natural Hinglish."
    };

    const lengths = {
      detailed: "Create detailed and comprehensive material.",
      balanced: "Create balanced notes with useful explanations.",
      short: "Create concise revision-friendly material."
    };

    const systemPrompt = `
You are Study Buddy, a careful educational assistant.
Be accurate, clear and age-appropriate.
Never invent facts, dates, definitions or formulas.
Distinguish supplied facts from additional explanations.
Use readable Markdown.
${languages[language] || languages.same}
${lengths[length] || lengths.detailed}
`;

    const userPrompt = `
TASK:
${prompts[task]}

${task === "question" ? "STUDENT QUESTION:\n" + String(question).slice(0, 2000) : ""}

SOURCE MATERIAL:
"""
${notes}
"""

Produce the complete answer.
`;

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("AI API:", data.error?.message || response.status);
      return res.status(502).json({
        error: data.error?.message || "AI request failed."
      });
    }

    const answer = data.choices?.[0]?.message?.content;

    if (!answer) {
      return res.status(502).json({ error: "AI returned an empty response." });
    }

    res.json({ answer, task });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`AI Study Buddy running at http://localhost:${PORT}`);
});
