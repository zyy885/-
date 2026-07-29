import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import { speak } from '../utils/speech.js';

const QTYPE_LABELS = {
  en_to_zh: { text: '英译汉', cls: 'badge-blue' },
  zh_to_en: { text: '汉译英', cls: 'badge-green' },
  choice: { text: '选择题', cls: 'badge-purple' },
  spelling: { text: '拼写题', cls: 'badge-orange' },
  listening: { text: '听力题', cls: 'badge-pink' },
};

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
  const [showConfirm, setShowConfirm] = useState(false);
  const spokenRef = useRef({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const params = {};
      if (wordBookId) params.word_book_id = wordBookId;
      if (wordListId) params.word_list_id = wordListId;
      params.count = sp.get('count') || 20;
      params.mode = sp.get('mode') || 'fill_blank';
      params.lang_mode = sp.get('lang_mode') || 'mixed';
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

  const playListeningAudio = (q) => {
    if (!spokenRef.current[q.word_id]) {
      spokenRef.current[q.word_id] = true;
    }
    speak(q.word);
  };

  useEffect(() => {
    if (loading || phase !== 'test') return;
    const q = questions[idx];
    if (q && q.question_type === 'listening' && !spokenRef.current[q.word_id]) {
      const t = setTimeout(() => {
        playListeningAudio(q);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [idx, loading, phase, questions]);

  const doSubmit = async () => {
    try {
      const ansArr = questions.map(q => ({
        word_id: q.word_id,
        user_answer: answers[q.word_id] || '',
        question_type: q.question_type || 'en_to_zh',
        lang_mode: q.lang_mode,
      }));
      const data = await api.submitSelfTest({
        word_book_id: wordBookId || null,
        word_list_id: wordListId || null,
        answers: ansArr
      });
      const records = questions.map((q, i) => {
        const a = data.answers?.[i] || {};
        return { ...q, user_answer: answers[q.word_id] || '', is_correct: a.is_correct ? 1 : 0 };
      });
      setResult({ ...data, records });
      setPhase('result');
    } catch (e) {
      alert(e.message);
    } finally {
      setShowConfirm(false);
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
          {result.records.map((r, i) => {
            const qtype = r.question_type;
            let correctAnswer;
            if (qtype === 'zh_to_en' || qtype === 'spelling' || qtype === 'listening') {
              correctAnswer = r.word;
            } else if (qtype === 'choice') {
              correctAnswer = r.lang_mode === 'zh_to_en' ? r.word : r.meaning;
            } else {
              correctAnswer = r.meaning;
            }
            return (
              <div key={r.word_id} className={'result-item ' + (r.is_correct ? 'correct' : 'wrong')}>
                <div className="result-num">{i + 1}</div>
                <div className="result-content">
                  <p className="word-text" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {r.word}
                    <button className="icon-btn" onClick={() => speak(r.word)} title="发音">🔊</button>
                  </p>
                  <p className="muted small">题型：{(QTYPE_LABELS[qtype] || QTYPE_LABELS.en_to_zh).text}</p>
                  <p className="muted small">你的答案：{r.user_answer || '(空)'}</p>
                  <p className="muted small">正确答案：{correctAnswer}</p>
                </div>
                <div className="result-indicator">{r.is_correct ? '✓' : '✗'}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const q = questions[idx];
  const answeredCount = Object.values(answers).filter(a => a.trim()).length;
  const qType = q.question_type || 'en_to_zh';
  const qLabel = QTYPE_LABELS[qType] || QTYPE_LABELS.en_to_zh;

  const renderQuestionBody = () => {
    if (qType === 'en_to_zh' || qType === 'zh_to_en') {
      return (
        <>
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
        </>
      );
    }

    if (qType === 'choice') {
      const isEnToZh = q.lang_mode === 'en_to_zh';
      return (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8 }}>
            <p className="test-word">{isEnToZh ? q.word : q.meaning}</p>
            {isEnToZh && (
              <button className="icon-btn" onClick={() => speak(q.word)} title="发音">🔊</button>
            )}
          </div>
          <div className="choice-options">
            {q.options.map(opt => (
              <button
                key={opt.label}
                className={`choice-btn ${answers[q.word_id] === opt.text ? 'selected' : ''}`}
                onClick={() => setAnswers({ ...answers, [q.word_id]: opt.text })}
              >
                <span className="choice-label">{opt.label}</span>
                <span className="choice-text">{opt.text}</span>
              </button>
            ))}
          </div>
        </>
      );
    }

    if (qType === 'spelling') {
      return (
        <>
          <div style={{ marginTop: 8 }}>
            <p className="muted" style={{ textAlign: 'center', marginBottom: 8 }}>根据中文释义拼写英文单词</p>
            <p className="test-word" style={{ textAlign: 'center' }}>{q.meaning}</p>
          </div>
          <div className="spelling-hint" style={{ textAlign: 'center', margin: '16px 0', fontSize: 20, letterSpacing: 4, fontFamily: 'monospace', color: '#6366f1' }}>
            {q.hint}
          </div>
          <input
            className="test-input"
            placeholder="请输入英文单词"
            value={answers[q.word_id] || ''}
            onChange={e => setAnswers({ ...answers, [q.word_id]: e.target.value })}
            autoFocus
          />
        </>
      );
    }

    if (qType === 'listening') {
      return (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginTop: 8 }}>
            <button className="listen-btn" onClick={() => speak(q.word)}>
              <span style={{ fontSize: 32 }}>🔊</span>
              <span>点击播放发音</span>
            </button>
            <p className="muted small">听发音，选择正确的单词</p>
          </div>
          <div className="choice-options">
            {q.options.map((opt, i) => (
              <button
                key={i}
                className={`choice-btn ${answers[q.word_id] === opt.word ? 'selected' : ''}`}
                onClick={() => setAnswers({ ...answers, [q.word_id]: opt.word })}
              >
                <span className="choice-label">{String.fromCharCode(65 + i)}</span>
                <span className="choice-text">
                  <strong>{opt.word}</strong>
                  <span className="muted small" style={{ marginLeft: 8 }}>{opt.meaning}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      );
    }

    return null;
  };

  return (
    <div className="test-page">
      <div className="page-header">
        <button className="btn-link" onClick={() => navigate(-1)}>← 返回</button>
        <h2>自测 ({idx + 1}/{questions.length})</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowConfirm(true)} disabled={answeredCount === 0}>
          提交 ({answeredCount}/{questions.length})
        </button>
      </div>
      <div className="test-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span className={'badge ' + qLabel.cls} style={{ fontSize: 13 }}>{qLabel.text}</span>
        </div>
        {renderQuestionBody()}
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

      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-content confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>确认提交</h3>
            <p>你已完成 {answeredCount}/{questions.length} 题，确定要提交吗？</p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowConfirm(false)}>取消</button>
              <button className="btn btn-primary" onClick={doSubmit}>确认提交</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
