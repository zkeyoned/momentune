import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { MusicPlayer } from './components/MusicPlayer';
import { HomePage } from './pages/HomePage';
import { ResultPage } from './pages/ResultPage';
import { TimelinePage } from './pages/TimelinePage';
import { CalendarPage } from './pages/CalendarPage';
import { JournalDetailPage } from './pages/JournalDetailPage';
import { SettingsPage } from './pages/SettingsPage';

function AppLayout() {
  const { pathname } = useLocation();

  // 所有页面两侧统一黑色(营造沉浸式取景框感),app-shell 内部保持暖色胶片主题
  useEffect(() => {
    document.body.style.backgroundColor = '#0a0a0a';
    return () => {
      document.body.style.backgroundColor = '';
    };
  }, [pathname]);

  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/result" element={<ResultPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          {/* 兼容旧 /journal 路径,重定向到时间线 */}
          <Route path="/journal" element={<Navigate to="/timeline" replace />} />
          <Route path="/journal/:id" element={<JournalDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      <BottomNav />
      {/* ResultPage 有自己的内嵌播放器,全局悬浮条在该路由下隐藏避免双播放器 */}
      {pathname !== '/result' && <MusicPlayer />}
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
