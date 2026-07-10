import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// 字体自托管:用 @fontsource npm 包替代 Google Fonts CDN
// font-family 名字与 global.css 的 CSS 变量完全一致,无需改其他文件
// Newsreader(衬线英文): 300/400/500/600 + italic 300/400/500
import '@fontsource/newsreader/latin-300.css';
import '@fontsource/newsreader/latin-400.css';
import '@fontsource/newsreader/latin-500.css';
import '@fontsource/newsreader/latin-600.css';
import '@fontsource/newsreader/latin-300-italic.css';
import '@fontsource/newsreader/latin-400-italic.css';
import '@fontsource/newsreader/latin-500-italic.css';
// Noto Serif SC(中文宋体): 300/400/500/600/700
import '@fontsource/noto-serif-sc/chinese-simplified-300.css';
import '@fontsource/noto-serif-sc/chinese-simplified-400.css';
import '@fontsource/noto-serif-sc/chinese-simplified-500.css';
import '@fontsource/noto-serif-sc/chinese-simplified-600.css';
import '@fontsource/noto-serif-sc/chinese-simplified-700.css';
// Noto Sans SC(中文黑体): 300/400/500
import '@fontsource/noto-sans-sc/chinese-simplified-300.css';
import '@fontsource/noto-sans-sc/chinese-simplified-400.css';
import '@fontsource/noto-sans-sc/chinese-simplified-500.css';
// JetBrains Mono(等宽): 400/500
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';

import './styles/reset.css';
import './styles/global.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Momentune: #root element not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
