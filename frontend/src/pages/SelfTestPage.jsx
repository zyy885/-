import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api.js';

function speak(word) {
  try { const u = new SpeechSynthesisUtterance(word); u.lang = 'en-US'; speechSynthesis.speak(u); } catch (e) {}
}

export default function SelfTestPage() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const wordBookId = sp.get('word_book_id');
  const wordListId = sp.get('word_list_id');
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('test');
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const params = {};
      if (wordBookId) params.word_book_id = wordBookId;
      if (wordListId) params.word_list_id = wordListId;
      params.count = 20;
      params.mode = 'mixed';
      const data = await api.getSelfTestWords(params);
      if (!data.questions || data.questions.length === 0) {
        alert('该词表/单词书下暂无单词');
        navigate(-1);
        return;
      }
      setQuestions(data.questions);
      const init = {};
      for (const q of data.questions) init[q.word_id] = '';
      setAnswers(init);
    } catch (e) {
      alert(e.message);
      navigate(-1);
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!confirm('确认提交自测？')) return;
    try {
      const ansArr = questions.map(q => ({
        word_id: q.word_id,
        user_answer: answers[q.word_id] || '',
        question_type: q.question_type || 'en_to_zh'
      }));
      const data = await api.submitSelfTest({
        word_book_id: wordBookId || null,
        word_list_id: wordListId || null,
        answers: ansArr
      });
      const records = ansArr.map((a, i) => {
        const q = questions[i];
        return { ...q, user_answer: a.user_answer, is_correct: a.is_correct ? 1 : 0 };
      });
      setResult({ ...data, records });
      setPhase('result');
    } catch (e) {
      alert(e.message);
    }
  };

  if (loading) return <div className="loading">加载中...</div>;

  if (phase === 'result' && result) {
    return (
      <div className="test-page">
        <div className="page-header">
          <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
          <h2>自测结果</h2>
          <div />
        </div>
        <div className="result-card">
          <div className="score-circle">
            <span className="score-num">{Math.round(result.score)}</span>
            <span className="score-label">分</span>
          </div>
          <p className="muted">答对 {result.correct} / {result.total} 题</p>
          {result.score >= 70 && <p className="badge badge-green" style={{ marginTop: 8 }}>🎉 可以打卡啦！</p>}
          {result.score < 70 && <p className="badge badge-gray" style={{ marginTop: 8 }}>正确率不足 70%，继续加油！</p>}
        </div>
        <div className="result-list">
          {result.records.map((r, i) => (
            <div key={r.word_id} className={'result-item ' + (r.is_correct ? 'correct' : 'wrong')}>
              <div className="result-num">{i + 1}</div>
              <div className="result-content">
                <p className="word-text" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {r.word}
                  <button className="icon-btn" onClick={() => speak(r.word)} title="发音">🔊</button>
                </p>
                <p className="muted small">你的答案：{r.user_answer || '(空)'}</p>
                <p className="muted small">正确答案：{(r.question_type || 'en_to_zh') === 'en_to_zh' ? r.meaning : r.word}</p>
              </div>
              <div className="result-indicator">{r.is_correct ? '✓' : '✗'}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const q = questions[idx];
  const answeredCount = Object.values(answers).filter(a => a.trim()).length;
  const qType = q.question_type || 'en_to_zh';

  return (
    <div className="test-page">
      <div className="page-header">
        <Link to="/student/word-lists" className="btn-link">← 返回词表</Link>
        <h2>自测 ({idx + 1}/{questions.length})</h2>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={answeredCount === 0}>
          提交 ({answeredCount}/{questions.length})
        </button>
      </div>
      <div className="test-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span className={'badge ' + (qType === 'en_to_zh' ? 'badge-blue' : 'badge-green')} style={{ fontSize: 13 }}>
            {qType === 'en_to_zh' ? '英译汉' : '汉译英'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 }}>
          <p className="test-word">{qType === 'en_to_zh' ? q.word : q.meaning}</p>
          {qType === 'en_to_zh' && (
            <button className="icon-btn" onClick={() => speak(q.word)} title="发音">🔊</button>
          )}
        </div>
        <input
          className="test-input"
          placeholder={qType === 'en_to_zh' ? '请输入中文释义' : '请输入英文单词'}
          value={answers[q.word_id] || ''}
          onChange={e => setAnswers({ ...answers, [q.word_id]: e.target.value })}
          autoFocus
        />
      </div>
      <div className="study-controls">
        <button className="btn btn-outline" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>上一题</button>
        <button className="btn btn-primary" onClick={() => setIdx(Math.min(questions.length - 1, idx + 1))} disabled={idx === questions.length - 1}>下一题</button>
      </div>
      <div className="test-nav">
        {questions.map((w, i) => (
          <button
            key={w.word_id}
            className={'nav-dot' + (i === idx ? ' active' : '') + (answers[w.word_id] ? ' filled' : '')}
            onClick={() => setIdx(i)}
          >{i + 1}</button>
        ))}
      </div>
    </div>
  );
}
