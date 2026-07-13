import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import { MusicPlayer } from './components/MusicPlayer';
import { useThemeStore } from './stores/themeStore';
import { HomePage } from './pages/HomePage';
import { ResultPage } from './pages/ResultPage';
import { TimelinePage } from './pages/TimelinePage';
import { CalendarPage } from './pages/CalendarPage';
import { JournalDetailPage } from './pages/JournalDetailPage';
import { SettingsPage } from './pages/SettingsPage';

function AppLayout() {
  const { pathname } = useLocation();
  const refreshTheme = useThemeStore((s) => s.refresh);

  // 主题初始化:auto 模式下每 10 分钟检查一次时间,跨过 7:00/19:00 时自动切换
  useEffect(() => {
    refreshTheme();
    const timer = setInterval(refreshTheme, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [refreshTheme]);

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
