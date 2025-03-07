import React, { useState, useEffect } from 'react';
import { supabase, checkDatabaseConnection } from '@/lib/supabase';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { User } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

interface AuthWrapperProps {
  children: React.ReactNode;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState(true);

  useEffect(() => {
    // Check database connection
    checkDatabaseConnection().then(connected => {
      setDbConnected(connected);
      if (!connected) {
        setError("Ошибка соединения с базой данных. Пожалуйста, обновите страницу.");
      }
    });
    
    // Set up auth state change listener
    try {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          setUser(session?.user ?? null);
          setLoading(false);
        }
      );

      // Get initial session
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
          console.error("Auth session error:", error.message);
          setError("Не удалось получить сессию аутентификации. Пожалуйста, попробуйте еще раз.");
        } else {
          setUser(session?.user ?? null);
        }
        setLoading(false);
      }).catch(err => {
        console.error("Auth session fetch error:", err);
        setError("Ошибка соединения. Пожалуйста, проверьте ваше интернет-соединение.");
        setLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch (err) {
      console.error("Auth setup error:", err);
      setError("Произошла непредвиденная ошибка. Пожалуйста, перезагрузите страницу.");
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[#121212]">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (error || !dbConnected) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[#121212] p-4">
        <div className="w-full max-w-md p-6 bg-neutral-900 rounded-lg border border-neutral-800 shadow-lg">
          <h1 className="text-2xl font-bold mb-6 text-center text-white">Focus 5</h1>
          <div className="p-4 bg-red-900/30 border border-red-900/50 rounded-md mb-4">
            <p className="text-red-300">{error || "Ошибка соединения с базой данных"}</p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md font-medium"
          >
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[#121212] p-4">
        <div className="w-full max-w-md p-6 bg-neutral-900 rounded-lg border border-neutral-800 shadow-lg">
          <h1 className="text-2xl font-bold mb-6 text-center text-white">Focus 5</h1>
          <Auth
            supabaseClient={supabase}
            appearance={{ 
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#2563eb',
                    brandAccent: '#1d4ed8',
                    inputBackground: '#1e1e1e',
                    inputBorder: '#333',
                    inputText: 'white',
                    inputLabelText: '#aaa',
                    inputPlaceholder: '#666',
                  }
                }
              }
            }}
            providers={[]}
            localization={{
              variables: {
                sign_in: {
                  email_label: 'Email адрес',
                  password_label: 'Пароль',
                  button_label: 'Войти',
                  link_text: 'Уже есть аккаунт? Войти'
                },
                sign_up: {
                  email_label: 'Email адрес',
                  password_label: 'Пароль',
                  button_label: 'Регистрация',
                  link_text: 'Нет аккаунта? Зарегистрироваться'
                }
              }
            }}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthWrapper;