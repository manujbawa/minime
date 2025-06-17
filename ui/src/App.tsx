import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { theme } from './theme';
import { LayoutMUI as Layout } from './components/LayoutMUI';
import { Dashboard } from './pages/Dashboard';
import { MemoryExplorer } from './pages/MemoryExplorer';
import { AdminData } from './pages/AdminData';
import { ProjectsMUI as Projects } from './pages/ProjectsMUI';
import { ProjectDetails } from './pages/ProjectDetails';
import { SequentialThinking } from './pages/SequentialThinking';
import { Analytics } from './pages/Analytics';
import { Search } from './pages/Search';
import { MCPTools } from './pages/MCPTools';
import { MetaLearning } from './pages/MetaLearning';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <style>{`
        * {
          box-sizing: border-box;
        }
        html, body, #root {
          overflow-x: hidden;
          max-width: 100vw;
        }
      `}</style>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:projectName" element={<ProjectDetails />} />
            <Route path="/memories" element={<MemoryExplorer />} />
            <Route path="/thinking" element={<SequentialThinking />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/search" element={<Search />} />
            <Route path="/mcp-tools" element={<MCPTools />} />
            <Route path="/meta-learning" element={<MetaLearning />} />
            <Route path="/admin" element={<AdminData />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;