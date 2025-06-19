import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, CircularProgress, Box } from '@mui/material';
import { theme } from './theme';
import { LayoutMUI as Layout } from './components/LayoutMUI';

// Lazy load all pages for code splitting - using direct default exports
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const MemoryExplorer = React.lazy(() => import('./pages/MemoryExplorer')); 
const Administration = React.lazy(() => import('./pages/Administration'));
const Projects = React.lazy(() => import('./pages/ProjectsMUI'));
const ProjectDetails = React.lazy(() => import('./pages/ProjectDetails'));
const SequentialThinking = React.lazy(() => import('./pages/SequentialThinking'));
const Analytics = React.lazy(() => import('./pages/Analytics'));

const MCPTools = React.lazy(() => import('./pages/MCPTools'));
const MetaLearning = React.lazy(() => import('./pages/MetaLearning'));

// Loading component
const PageLoader = () => (
  <Box sx={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '60vh',
    flexDirection: 'column',
    gap: 2
  }}>
    <CircularProgress size={48} />
  </Box>
);

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
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:projectName" element={<ProjectDetails />} />
              <Route path="/memories" element={<MemoryExplorer />} />
              <Route path="/thinking" element={<SequentialThinking />} />
              <Route path="/analytics" element={<Analytics />} />
  
              <Route path="/mcp-tools" element={<MCPTools />} />
              <Route path="/meta-learning" element={<MetaLearning />} />
              <Route path="/admin" element={<Administration />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Layout>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;