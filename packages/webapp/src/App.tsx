import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Properties } from './pages/Properties';
import { Queue } from './pages/Queue';
import { Settings } from './pages/Settings';
import { FieldOpsReview } from './pages/FieldOpsReview';
import { MobileRoutePack } from './pages/MobileRoutePack';

function App() {
  return (
    <AppProvider>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/properties" element={<Properties />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/field-ops" element={<FieldOpsReview />} />
            <Route path="/mobile-pack" element={<MobileRoutePack />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </HashRouter>
    </AppProvider>
  );
}

export default App;
