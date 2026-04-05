import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { LiveSession } from './pages/LiveSession';
import { Gallery } from './pages/Gallery';
import { Settings } from './pages/Settings';
import { SeoOptimizer } from './pages/SeoOptimizer';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<LiveSession />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="seo" element={<SeoOptimizer />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
