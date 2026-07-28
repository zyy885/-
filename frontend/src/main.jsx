import React, { Component } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { e: null }; }
  static getDerivedStateFromError(e) { return { e: (e && e.message ? e.message : '') || String(e) }; }
  componentDidCatch(e) { console.error('[ErrorBoundary]', e); }
  render() {
    if (this.state.e) {
      return React.createElement('div', {style:{padding:'40px 20px',textAlign:'center',minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'#f5f7fa'}},
        React.createElement('div',{style:{fontSize:'48px',marginBottom:'16px'}},'[X]'),
        React.createElement('h2',{style:{color:'#333',marginBottom:'8px'}},'页面加载异常'),
        React.createElement('p',{style:{color:'#666',marginBottom:'20px',fontSize:'14px'}},this.state.e || '请刷新页面重试'),
        React.createElement('button',{onClick:()=>location.reload(),style:{padding:'10px 24px',background:'linear-gradient(135deg,#667eea 0%,#764ba2 100%)',color:'#fff',border:'none',borderRadius:'8px',fontSize:'15px',cursor:'pointer'}},'刷新页面')
      );
    }
    return this.props.children;
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
      if (regs.length > 0) location.reload();
    }).catch(() => {});
  });
}


function removeLoader() {
  var l = document.getElementById('boot-loader');
  if (l) { l.style.opacity = '0'; l.style.transition = 'opacity 0.3s'; setTimeout(function(){ l.remove(); }, 300); }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
setTimeout(removeLoader, 50);
setTimeout(removeLoader, 50);
