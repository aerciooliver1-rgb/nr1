'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import PasswordInput from '@/components/forms/PasswordInput'

export default function LoginPage() {
  const router = useRouter()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function doLogin() {
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/dashboard')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar.')
    } finally {
      setLoading(false)
    }
  }

  async function doSignup() {
    setError('')
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (error) {
        setError(error.message)
      } else if (data.session) {
        router.push('/dashboard')
      } else {
        setError('Verifique seu e-mail para confirmar o cadastro.')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta.')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit() {
    if (isLogin) {
      doLogin()
    } else {
      doSignup()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  return (
    <div className="login-container">
      {/* LEFT PANEL */}
      <div className="login-left">
        <div className="login-brand">
          <div className="login-brand-icon">{'⚡'}</div>
          <div className="login-brand-text">
            <h3>DRPS NR-1</h3>
            <span>RISCOS PSICOSSOCIAIS</span>
          </div>
        </div>

        <div className="login-hero">
          <div className="eyebrow">{"DIAGNÓSTICO DE RISCOS PSICOSSOCIAIS"}</div>
          <h1 className="hero-heading">
            {"Conformidade NR-1 "}<span className="text-accent">{"com precisão clínica."}</span>
          </h1>
          <p className="hero-desc">
            {"Plataforma completa para avaliação, diagnóstico e gestão de riscos psicossociais conforme NR-1 e Portaria MTE nº 1.419/2024."}
          </p>
          <div className="login-stats">
            <div>
              <div className="login-stat-value">13</div>
              <div className="login-stat-label">FATORES</div>
            </div>
            <div>
              <div className="login-stat-value">55</div>
              <div className="login-stat-label">{"QUESTÕES"}</div>
            </div>
            <div>
              <div className="login-stat-value">LGPD</div>
              <div className="login-stat-label">CONFORME</div>
            </div>
          </div>
        </div>

        <div className="login-footer">
          {"NR-1 · Portaria MTE nº 1.419/2024 · Guia MTE 2025"}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="login-right">
        <div className="login-card">
          <div className="logo">
            <h1>DRPS NR-1</h1>
            <p>Riscos Psicossociais</p>
            <span className="badge">{"NR-1 · PORTARIA MTE Nº 1.419/2024"}</span>
          </div>

          {isLogin ? (
            <>
              <h2 className="login-card-title">Entrar</h2>
              <p className="login-card-subtitle">Acesse sua conta para continuar</p>

              <div className="form-group">
                <label>E-mail</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>

              <div className="form-group">
                <label>Senha</label>
                <div className="password-wrapper">
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Sua senha"
                  />
                </div>
              </div>

              <a
                className="forgot-link"
                href="#"
                onClick={(e) => e.preventDefault()}
              >
                Esqueceu a senha?
              </a>

              {error && (
                <div className="alert alert-danger">{error}</div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={loading}
                onClick={doLogin}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>

              <div className="toggle-link">
                {"Não tem conta? "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setError('')
                    setIsLogin(false)
                  }}
                >
                  Criar conta
                </a>
              </div>

              <div className="lgpd-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Dados protegidos pela LGPD
              </div>
            </>
          ) : (
            <>
              <h2 className="login-card-title">Criar conta</h2>
              <p className="login-card-subtitle">{"Cadastre-se para começar"}</p>

              <div className="form-group">
                <label>Nome completo</label>
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>

              <div className="form-group">
                <label>E-mail</label>
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>

              <div className="form-group">
                <label>Senha</label>
                <div className="password-wrapper">
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Crie uma senha"
                  />
                </div>
              </div>

              {error && (
                <div className="alert alert-danger">{error}</div>
              )}

              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                disabled={loading}
                onClick={doSignup}
              >
                {loading ? 'Criando...' : 'Criar conta'}
              </button>

              <div className="toggle-link">
                {"Já tem conta? "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    setError('')
                    setIsLogin(true)
                  }}
                >
                  Entrar
                </a>
              </div>
            </>
          )}

          <div className="login-version">{"v2.0 — NR-1 Compliance"}</div>
        </div>
      </div>
    </div>
  )
}
