import { HashRouter, Routes, Route, Outlet } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { BottomNav } from './components/BottomNav';
import { HomePage } from './routes/HomePage';
import { CalendarPage } from './routes/CalendarPage';
import { ProgramsPage } from './routes/ProgramsPage';
import { WorkoutPage } from './routes/WorkoutPage';
import { ProgramEditorPage } from './routes/ProgramEditorPage';
import { ExerciseEditorPage } from './routes/ExerciseEditorPage';
import { WorkoutDetailPage } from './routes/WorkoutDetailPage';

function Layout() {
  return (
    <div className="layout">
      <div className="layout-content">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <div className="app">
        <HashRouter>
          <Routes>
            {/* Вкладки с нижним меню */}
            <Route element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="programs" element={<ProgramsPage />} />
            </Route>

            {/* Полноэкранные / пуш-экраны без нижнего меню */}
            <Route path="workout/:workoutId" element={<WorkoutPage />} />
            <Route path="program/new"        element={<ProgramEditorPage />} />
            <Route path="program/:programId" element={<ProgramEditorPage />} />
            <Route path="program/:programId/exercise/:exerciseId" element={<ExerciseEditorPage />} />
            <Route path="workouts/:workoutId" element={<WorkoutDetailPage />} />
          </Routes>
        </HashRouter>
      </div>
    </ThemeProvider>
  );
}
