import './App.css';
import Calendar from './components/Calendar';
import AuthWrapper from './components/AuthWrapper';

function App() {
  return (
    <div className="h-screen w-screen bg-[#121212] overflow-hidden p-0 m-0 flex flex-col">
      <AuthWrapper>
        <Calendar />
      </AuthWrapper>
    </div>
  );
}

export default App;