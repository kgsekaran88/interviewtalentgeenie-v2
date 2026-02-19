import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';


serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const AI_GATEWAY_API_KEY = Deno.env.get('AI_GATEWAY_API_KEY');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Accept optional interviewId to process a single interview
    let body: any = {};
    try { body = await req.json(); } catch { /* no body is fine */ }
    const targetInterviewId = body?.interviewId;

    // Get interviews - either specific one or all active
    let query = supabase
      .from('interviews')
      .select('id, title, job_description, topic_distribution, question_type_distribution, difficulty_distribution, question_count, question_bank_size, experience_level, min_years_experience, coding_schema')
      .in('status', ['active', 'pending_review']);
    
    if (targetInterviewId) {
      query = query.eq('id', targetInterviewId);
    }

    const { data: interviews, error: fetchError } = await query;

    if (fetchError) throw new Error(`Failed to fetch interviews: ${fetchError.message}`);

    const results: any[] = [];
    let totalGenerated = 0;

    for (const interview of interviews || []) {
      // Count existing questions
      const { count } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('interview_id', interview.id);

      if ((count || 0) > 0) {
        results.push({ id: interview.id, title: interview.title, status: 'skipped', reason: `Already has ${count} questions` });
        continue;
      }

      const topics = interview.topic_distribution || {};
      if (Object.keys(topics).length === 0) {
        results.push({ id: interview.id, title: interview.title, status: 'skipped', reason: 'No topic distribution' });
        continue;
      }

      const targetCount = interview.question_bank_size || interview.question_count || 25;
      const typeDistribution = interview.question_type_distribution || { mcq: 40, scenario: 30, coding: 20, descriptive: 10 };
      const difficultyDistribution = interview.difficulty_distribution || { easy: 30, medium: 50, hard: 20 };

      // Build topic breakdown string
      const topicBreakdown = Object.entries(topics)
        .map(([topic, pct]) => `- ${topic}: ${pct}%`)
        .join('\n');

      const systemPrompt = `You are an expert technical interviewer. Generate exactly ${targetCount} interview questions for the role: "${interview.title}".

Job Description: ${interview.job_description}

Topic Distribution (percentage of questions per topic):
${topicBreakdown}

Question Type Distribution:
- MCQ (multiple choice): ${typeDistribution.mcq || 0}%
- Scenario-based: ${typeDistribution.scenario || 0}%
- Coding: ${typeDistribution.coding || 0}%
- Descriptive: ${typeDistribution.descriptive || 0}%

Difficulty Distribution:
- Easy: ${difficultyDistribution.easy || 30}%
- Medium: ${difficultyDistribution.medium || 50}%
- Hard: ${difficultyDistribution.hard || 20}%

${interview.experience_level ? `Target experience level: ${interview.experience_level}${interview.min_years_experience ? ` (${interview.min_years_experience}+ years)` : ''}` : ''}

Return ONLY a valid JSON array. Each question object must have:
- question_text: string
- topic: string (must match one of the topics above)
- difficulty: "easy" | "medium" | "hard"
- question_type: "mcq" | "scenario" | "coding" | "descriptive"
- options: string[] (4 options for MCQ, empty array for others)
- correct_answer: string (the correct answer text)

For coding questions, include a clear problem statement in question_text.`;

      try {
        if (!AI_GATEWAY_API_KEY) throw new Error('No AI provider available');

        const AI_GATEWAY_ENDPOINT = Deno.env.get('AI_GATEWAY_URL') ? `${Deno.env.get('AI_GATEWAY_URL')}/chat/completions` : (() => { throw new Error('AI_GATEWAY_URL environment variable is required'); })();
        const response = await fetch(AI_GATEWAY_ENDPOINT, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${AI_GATEWAY_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Generate ${targetCount} questions now.` }
            ],
            max_tokens: 8000
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`AI request failed (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const content = data.choices[0].message.content;
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error('Failed to parse questions from AI response');

        const rawQuestions = JSON.parse(jsonMatch[0].replace(/,(\s*[}\]])/g, '$1'));

        // Dedup
        const seen = new Set<string>();
        const unique: any[] = [];
        for (const q of rawQuestions) {
          const norm = (q.question_text || '').toLowerCase().trim().replace(/\s+/g, ' ').substring(0, 300);
          if (!norm || seen.has(norm)) continue;
          seen.add(norm);
          unique.push(q);
        }

        // Determine allowed_languages for coding questions
        const getAllowedLanguages = (topic: string, questionType: string): string[] | null => {
          if (questionType !== 'coding') return null;
          const t = topic.toLowerCase();
          if (t.includes('java') && !t.includes('javascript')) return ['java'];
          if (t.includes('python') || t.includes('pyspark') || t.includes('django') || t.includes('flask')) return ['python'];
          if (t.includes('javascript') || t.includes('typescript') || t.includes('react') || t.includes('node') || t.includes('angular') || t.includes('next.js')) return ['javascript', 'typescript'];
          if (t.includes('sql') || t.includes('database') || t.includes('snowflake') || t.includes('bigquery')) return ['sql'];
          if (t.includes('go') || t.includes('golang')) return ['go'];
          if (t.includes('asp.net') || t.includes('c#') || t.includes('.net')) return ['csharp'];
          return ['javascript', 'python', 'java'];
        };

        const normalizeDifficulty = (d: string) => {
          const val = (d || 'medium').toLowerCase().trim();
          if (['easy', 'medium', 'hard'].includes(val)) return val;
          return 'medium';
        };
        const normalizeType = (t: string) => {
          const val = (t || 'descriptive').toLowerCase().trim();
          if (['mcq', 'scenario', 'coding', 'descriptive'].includes(val)) return val;
          return 'descriptive';
        };

        const questionsToInsert = unique.map((q: any, idx: number) => ({
          interview_id: interview.id,
          question_text: q.question_text,
          topic: q.topic,
          difficulty: normalizeDifficulty(q.difficulty),
          question_type: normalizeType(q.question_type),
          options: q.options || [],
          correct_answer: q.correct_answer || '',
          order_index: idx + 1,
          allowed_languages: getAllowedLanguages(q.topic || '', q.question_type || ''),
        }));

        const { error: insertError } = await supabase
          .from('questions')
          .insert(questionsToInsert);

        if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

        totalGenerated += questionsToInsert.length;
        results.push({
          id: interview.id,
          title: interview.title,
          status: 'success',
          questionsGenerated: questionsToInsert.length,
          targetCount
        });

        console.log(`✅ ${interview.title}: generated ${questionsToInsert.length} questions`);

        // Brief pause to avoid rate limiting
        await new Promise(r => setTimeout(r, 2000));

      } catch (genError) {
        console.error(`❌ ${interview.title}:`, genError);
        results.push({
          id: interview.id,
          title: interview.title,
          status: 'error',
          error: genError instanceof Error ? genError.message : 'Unknown error'
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      totalInterviews: interviews?.length || 0,
      totalGenerated,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Reconstruction error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
