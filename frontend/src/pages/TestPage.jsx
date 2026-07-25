import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';

function speak(word) {
  try { const u = new SpeechSynthesisUtterance(word); u.lang = 'en-US'; speechSynthesis.speak(u); } catch (e) {}
}

export default function TestPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('test');
  const [words, setWords] = useState([]);
  const [tsId, setTsId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    load();
  }, [id]);

  const load = async () => {
    try {
      const data = await api.getTestWords(id);
      setWords(data.words);
      setTsId(data.taskStudentId);
      const init = {};
      for (const w of data.words) init[w.id] = '';
      setAnswers(init);
    } catch (e) {
      alert(e.message);
      navigate('/student');
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!confirm('确认提交测试？')) return;
    try {
      const ansArr = words.map(w => ({ word_id: w.id, user_answer: answers[w.id] || '', question_type: w.question_type || 'en_to_zh' }));
      const data = await api.submitTest({ task_student_id: tsId, answers: ansArr });
      const resData = await api.getTestResult(id);
      setResult({ ...data, records: resData.records });
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
          <h2>测试结果</h2>
          <div />
        </div>
        <div className="result-card">
          <div className="score-circle">
            <span className="score-num">{Math.round(result.score)}</span>
            <span className="score-label">分</span>
          </div>
          <p className="muted">答对 {result.correct} / {result.total} 题</p>
        </div>
        <div className="result-list">
          {result.records.map((r, i) => (
            <div key={r.id} className={'result-item ' + (r.is_correct ? 'correct' : 'wrong')}>
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

  const word = words[idx];
  const answeredCount = Object.values(answers).filter(a => a.trim()).length;
  const qType = word.question_type || 'en_to_zh';

  return (
    <div className="test-page">
      <div className="page-header">
        <Link to="/student" className="btn-link">← 返回任务列表</Link>
        <h2>单词测试 ({idx + 1}/{words.length})</h2>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={answeredCount === 0}>
          提交 ({answeredCount}/{words.length})
        </button>
      </div>
      <div className="test-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className={'badge ' + (qType === 'en_to_zh' ? 'badge-blue' : 'badge-green')} style={{ fontSize: 13 }}>
            {qType === 'en_to_zh' ? '英译汉' : '汉译英'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 }}>
          <p className="test-word">{qType === 'en_to_zh' ? word.word : word.meaning}</p>
          {qType === 'en_to_zh' && (
            <button
              className="icon-btn"
              onClick={() => { try { const u = new SpeechSynthesisUtterance(word.word); u.lang='en-US'; speechSynthesis.speak(u); } catch(e){} }}
              title="发音"
            >🔊</button>
          )}
        </div>
        {word.example && qType === 'en_to_zh' && <p className="muted test-example">例句：{word.example}</p>}
        <input
          className="test-input"
          placeholder={qType === 'en_to_zh' ? '请输入中文释义' : '请输入英文单词'}
          value={answers[word.id] || ''}
          onChange={e => setAnswers({ ...answers, [word.id]: e.target.value })}
          autoFocus
        />
      </div>
      <div className="study-controls">
        <button className="btn btn-outline" onClick={() => setIdx(Math.max(0, idx - 1))} disabled={idx === 0}>上一题</button>
        <button className="btn btn-primary" onClick={() => setIdx(Math.min(words.length - 1, idx + 1))} disabled={idx === words.length - 1}>下一题</button>
      </div>
      <div className="test-nav">
        {words.map((w, i) => (
          <button
            key={w.id}
            className={'nav-dot' + (i === idx ? ' active' : '') + (answers[w.id] ? ' filled' : '')}
            onClick={() => setIdx(i)}
            title={(w.question_type || 'en_to_zh') === 'en_to_zh' ? '英译汉' : '汉译英'}
          >{i + 1}</button>
        ))}
      </div>
    </div>
  );
}
