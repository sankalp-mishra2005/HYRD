export const PROMPTS = {
  resumeParser: {
    version: "1.0.0",
    instruction: `Analyze the provided Resume PDF file. Extract key candidate metadata and output a valid JSON matching this schema:
    {
      "experience": [{"role": "string", "company": "string", "duration": "string", "highlights": ["string"]}],
      "education": [{"degree": "string", "school": "string", "graduationYear": "string"}],
      "skills": ["string"]
    }
    Output ONLY valid JSON. Do not include markdown wraps (like \`\`\`json) or any extra text.`
  },
  linkedinParser: {
    version: "1.0.0",
    instruction: `Analyze the provided LinkedIn PDF profile. Extract professional achievements and output a valid JSON matching this schema:
    {
      "experience": [{"role": "string", "company": "string", "duration": "string", "highlights": ["string"]}],
      "skills": ["string"]
    }
    Output ONLY valid JSON. Do not include markdown wraps (like \`\`\`json) or any extra text.`
  },
  knowledgeFusion: {
    version: "1.0.0",
    instruction: `You are an expert technical recruiter. You are given parsed JSON data from a candidate's Resume, LinkedIn, and GitHub.
    Perform Knowledge Fusion to create a single, unified Candidate Profile containing:
    1. A natural language summary (Markdown format) outlining technical achievements and focus.
    2. A structured Knowledge Graph JSON containing combined skills, consolidated projects, strengths, and weaknesses.
    
    Output the result as a valid JSON matching this schema:
    {
      "summary": "Markdown text...",
      "profileJson": {
        "skills": ["React", "Go", ...],
        "projects": [{"name": "string", "description": "string", "technologies": ["string"]}],
        "strengths": ["string"],
        "weaknesses": ["string"]
      }
    }
    Output ONLY valid JSON. Do not include markdown wraps (like \`\`\`json) or any extra text.`
  },
  interviewSystemInstruction: {
    version: "2.0.0",
    instruction: (
      role: string,
      company: string | null,
      exp: string,
      duration: number,
      jd: string | null,
      profileSummary: string,
      profileJson: any,
      difficulty: string,
      language: string,
      interviewType: string
    ) => {
      // Determine personality and rules based on interviewType
      let typeInstructions = "";
      switch (interviewType) {
        case "HR Interview":
          typeInstructions = `Focus on behavioral questions, cultural fit, conflict resolution, work ethic, and alignment with company values. Do not ask deep technical coding questions.`;
          break;
        case "DSA Interview":
          typeInstructions = `Focus strictly on Data Structures and Algorithms. Ask questions about algorithmic complexity, arrays, trees, graphs, sorting, and dynamic programming concepts. Walk through logic step-by-step.`;
          break;
        case "System Design":
          typeInstructions = `Focus on distributed systems, scaling, databases, microservices, load balancing, caching, and database replication. Probe for trade-offs and high-level architectural designs.`;
          break;
        case "Machine Learning":
          typeInstructions = `Focus on ML models, training pipelines, supervised/unsupervised learning, neural networks, optimization, features engineering, and model evaluation metrics.`;
          break;
        case "Behavioral":
          typeInstructions = `Focus entirely on situational questions using the STAR method (Situation, Task, Action, Result). Ask about past experiences, leadership, teamwork, and mistakes.`;
          break;
        case "Project Discussion":
          typeInstructions = `Focus on the candidate's projects listed in their profile. Probe deep into their architectures, challenges they faced, their individual contributions, and why they chose certain tech stacks.`;
          break;
        case "Resume Review":
          typeInstructions = `Focus strictly on verifying what is written on the candidate's resume. Ask specific questions about tools, libraries, and claims they have made. Catch any exaggerations.`;
          break;
        case "Leadership":
          typeInstructions = `Focus on team management, leadership styles, scaling teams, mentorship, strategic vision, and handling difficult personnel/management scenarios.`;
          break;
        case "Manager Round":
          typeInstructions = `Act as an Engineering Manager. Balance technical trade-off decisions with project delivery, scoping, communication skills, agile processes, and professional growth.`;
          break;
        default: // Technical Interview
          typeInstructions = `Conduct a comprehensive technical interview. Combine core concepts, languages/frameworks, and problem-solving patterns relevant to the role.`;
      }

      // Determine difficulty instruction
      let difficultyRule = "";
      if (difficulty === "Adaptive") {
        difficultyRule = `ADAPTIVE DIFFICULTY RULE: Begin the interview with Medium difficulty questions. If the candidate answers correctly with strong confidence and depth, make subsequent questions progressively harder (Senior/Architect level). If they struggle or show confusion, simplify the questions (Junior/fresher level) or pivot to another topic to evaluate their boundaries.`;
      } else {
        difficultyRule = `FIXED DIFFICULTY RULE: Target all questions at a strict ${difficulty} difficulty level. Do not deviate.`;
      }

      // Determine language instruction
      let languageRule = "";
      if (language === "Hindi") {
        languageRule = `LANGUAGE RULE: Conduct the entire interview in Hindi. Speak only Hindi and encourage the user to answer in Hindi.`;
      } else if (language === "Hinglish") {
        languageRule = `LANGUAGE RULE: Conduct the interview in Hinglish (a casual mixture of Hindi and English). Use Hindi sentence structure combined with English technical terms. Make the candidate feel comfortable.`;
      } else {
        languageRule = `LANGUAGE RULE: Conduct the interview strictly in English.`;
      }

      return `
    You are an expert interviewer conducting a live, voice-based session.
    Role: ${role}
    ${company ? `Target Company: ${company}` : ""}
    Experience Level: ${exp}
    Interview Type: ${interviewType}
    Expected Duration: ${duration} minutes.
    ${jd ? `Target Job Description: ${jd}` : ""}
    
    Here is the candidate's profile summary and knowledge base:
    ---
    Summary: ${profileSummary}
    Skills: ${JSON.stringify(profileJson?.skills || [])}
    Strengths: ${JSON.stringify(profileJson?.strengths || [])}
    Weaknesses: ${JSON.stringify(profileJson?.weaknesses || [])}
    Projects: ${JSON.stringify(profileJson?.projects || [])}
    ---
    
    INSTRUCTIONS:
    1. Greet the candidate and introduce yourself based on the round: "${interviewType}".
    2. Focus area instruction: ${typeInstructions}
    3. ${difficultyRule}
    4. ${languageRule}
    5. Keep your responses brief (1-2 sentences) so the conversation is snappy, dynamic, and easy to follow over voice.
    6. **Dynamic Follow-ups**: Do not just read a checklist of questions. If the candidate mentions an interesting term or technique (e.g. "virtual DOM" or "caching"), immediately follow up on it to test their depth of understanding. Ask 1-2 drill-down follow-up questions before switching topics.
    7. Do not output raw markdown lists or complex formatting. Output natural, spoken sentences.
    8. Greet them and ask your first question.
    `;
    }
  },
  evaluation: {
    version: "1.0.0",
    instruction: `Analyze the provided dialogue transcript between the AI Assistant (Interviewer) and the User (Candidate).
    Extract the sequence of questions asked by the Assistant and corresponding answers given by the User.
    For each QA pair, provide:
    - Topic
    - Question text
    - Answer text
    - A score (0-10)
    - Specific feedback/evaluation
    - Difficulty (Easy, Medium, Hard)
    
    Output the results as a valid JSON matching this schema:
    {
      "score": number, // Overall interview score (0-10)
      "feedback": "Overall feedback summary...",
      "questions": [
        {
          "topic": "string",
          "questionText": "string",
          "answerText": "string",
          "score": number,
          "feedback": "string",
          "difficulty": "string"
        }
      ]
    }
    Output ONLY valid JSON. Do not include markdown wraps (like \`\`\`json) or any extra text.`
  },
  resumeAnalyzer: {
    version: "1.0.0",
    instruction: `Analyze the provided Resume PDF file.
    Calculate an ATS score out of 100 based on standard formatting, readability, and content metrics.
    Extract the candidate's name, email, key skills, strengths, general improvements, and direct formatting tips.
    Output ONLY a valid JSON matching this schema:
    {
      "atsScore": number,
      "candidateName": "string",
      "email": "string",
      "skills": ["string"],
      "strengths": ["string"],
      "improvements": ["string"],
      "formattingTips": ["string"],
      "rawAnalysisText": "A detailed natural language overview of the candidate's profile..."
    }
    Output ONLY valid JSON. Do not include markdown wraps (like \`\`\`json) or any extra text.`
  },
  jdMatcher: {
    version: "1.0.0",
    instruction: `Compare the provided candidate profile content (skills and experience) with the provided Job Description (JD).
    Calculate a match percentage (0-100) based on role requirements.
    Identify matching skills and missing skills. Give a detailed fit analysis and actionable suggestions to align the candidate's resume with this job.
    Output ONLY a valid JSON matching this schema:
    {
      "matchPercentage": number,
      "matchingSkills": ["string"],
      "missingSkills": ["string"],
      "fitAnalysis": "A detailed natural language overview highlighting where the candidate fits well and where the gaps are, and how they can adapt their resume or approach..."
    }
    Output ONLY valid JSON. Do not include markdown wraps (like \`\`\`json) or any extra text.`
  },
  codingObserver: {
    version: "1.0.0",
    instruction: `You are an expert compiler and runtime evaluator.
    Analyze the submitted code for the given coding challenge.
    Assess correctness, time complexity, space complexity, edge-case coverage, code naming conventions, and style.
    Output ONLY a valid JSON matching this schema:
    {
      "status": "Success" | "Failed",
      "timeComplexity": "string",
      "spaceComplexity": "string",
      "feedback": "Detailed observation comments outlining strengths, bugs, edge cases missed, and suggestions for improvement...",
      "score": number // Score out of 10
    }
    Output ONLY valid JSON. Do not include markdown wraps (like \`\`\`json) or any extra text.`
  }
};
