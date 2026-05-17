// RadarComponents.jsx — core UI kit pieces for RADAR app

const fmtARS = (n) => {
  const neg = n < 0;
  const abs = Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${neg ? '− ' : ''}$ ${abs}`;
};
const fmtUSD = (n) => `US$ ${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ---- Icons (Lucide, inlined, stroke 1.5) ----
const Ico = ({ d, size = 20, stroke = 1.5, fill }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || 'none'}
    stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
    style={{ display: 'block', flexShrink: 0 }}
    dangerouslySetInnerHTML={{ __html: d }}/>
);
const ICONS = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  list: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>',
  users: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  dollar: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  up: '<path d="M7 17L17 7"/><path d="M8 7h9v9"/>',
  down: '<path d="M17 7L7 17"/><path d="M16 17H7V8"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/>',
  more: '<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  close: '<path d="M18 6L6 18M6 6l12 12"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pie: '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  card: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M2 10h20"/>',
  wallet: '<path d="M20 12V8H6a2 2 0 0 1 0-4h14v4"/><path d="M20 12v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6"/><circle cx="16" cy="14" r="1.5" fill="currentColor"/>',
  split: '<path d="M6 3v18M18 3v18"/><circle cx="6" cy="8" r="2"/><circle cx="18" cy="16" r="2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/>',
  whatsapp: '<path d="M21 12a9 9 0 1 1-3.5-7.1L21 3l-1.9 3.5A9 9 0 0 1 21 12z"/><path d="M8 10s1 3 4 4l1.5-1.5 2 1-1 2s-5 0-7-5z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
};
const Icon = ({ name, ...rest }) => <Ico d={ICONS[name]} {...rest}/>;

// ---- Brand hash color (avatars) ----
const AV_HUES = ['#0077B6','#8B5CF6','#F59E0B','#10B981','#EF4444','#14B8A6','#EC4899','#3B82F6'];
const hueFor = (s) => AV_HUES[[...(s||'?')].reduce((a,c) => a + c.charCodeAt(0), 0) % AV_HUES.length];

const Avatar = ({ name, size = 36, bg }) => {
  const initials = (name||'?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: bg || hueFor(name), color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: size * 0.38, flexShrink: 0,
    }}>{initials}</div>
  );
};

const AvatarStack = ({ names, max = 3 }) => {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((n, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -10, border: '2px solid var(--bg-1)', borderRadius: 999 }}>
          <Avatar name={n} size={28}/>
        </div>
      ))}
      {extra > 0 && (
        <div style={{ marginLeft: -10, border: '2px solid var(--bg-1)', borderRadius: 999,
          width: 28, height: 28, background: 'var(--bg-3)', color: 'var(--fg-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600 }}>+{extra}</div>
      )}
    </div>
  );
};

// ---- Button ----
const Button = ({ variant = 'primary', size = 'md', children, onClick, icon, full, disabled, style }) => {
  const base = {
    fontFamily: 'var(--font-sans)', fontWeight: 600,
    border: '1px solid transparent',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'transform 120ms var(--ease-out), background 200ms var(--ease-out)',
    opacity: disabled ? 0.4 : 1,
    width: full ? '100%' : 'auto',
  };
  const sizes = {
    sm: { fontSize: 13, padding: '8px 14px', borderRadius: 10 },
    md: { fontSize: 15, padding: '12px 18px', borderRadius: 14 },
    lg: { fontSize: 16, padding: '16px 20px', borderRadius: 16 },
  };
  const variants = {
    primary: {
      background: '#0077B6', color: 'white',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 6px 18px rgba(0,119,182,0.3)',
    },
    secondary: { background: 'var(--bg-2)', color: 'var(--fg-1)', borderColor: 'var(--line-2)' },
    ghost: { background: 'transparent', color: 'var(--radar-300)' },
    destructive: { background: 'rgba(239,68,68,0.14)', color: '#F87171', borderColor: 'rgba(239,68,68,0.35)' },
  };
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
      onMouseUp={e => e.currentTarget.style.transform = ''}
      onMouseLeave={e => e.currentTarget.style.transform = ''}
      style={{ ...base, ...sizes[size], ...variants[variant], ...style }}>
      {icon && <Icon name={icon} size={16}/>}
      {children}
    </button>
  );
};

// ---- Card ----
const Card = ({ children, raised, style }) => (
  <div style={{
    background: raised ? 'var(--bg-2)' : 'var(--bg-1)',
    border: '1px solid var(--line-1)',
    borderRadius: 20,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 20px rgba(0,0,0,0.25)',
    ...style,
  }}>{children}</div>
);

// ---- Expense row ----
const ExpenseRow = ({ icon, title, sub, amount, currency = 'ARS', type = 'expense', tag, isLast }) => {
  const pos = type === 'income';
  const color = pos ? '#34D399' : '#F87171';
  const sign = pos ? '+' : '−';
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 12, alignItems: 'center',
      padding: '12px 16px',
      borderBottom: isLast ? 'none' : '1px solid var(--line-1)',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: icon?.bg || 'var(--bg-3)', color: icon?.c || '#4FB3DC',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700,
      }}>{icon?.label || '$'}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 1 }}>{sub}</div>
      </div>
      <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, fontSize: 14, color }}>
        {sign} {currency === 'USD' ? fmtUSD(amount) : fmtARS(amount).replace(/^− /, '')}
        {tag && <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 500, marginTop: 1 }}>{tag}</div>}
      </div>
    </div>
  );
};

// ---- Tab bar ----
const TabBar = ({ active, onChange, onFab }) => {
  const items = [
    { id: 'home', label: 'Inicio', icon: 'home' },
    { id: 'list', label: 'Gastos', icon: 'list' },
    { id: 'fab', label: '', icon: 'plus', fab: true },
    { id: 'groups', label: 'Grupos', icon: 'users' },
    { id: 'profile', label: 'Perfil', icon: 'user' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 12, right: 12, bottom: 18,
      background: 'rgba(15,23,36,0.78)', backdropFilter: 'blur(24px) saturate(180%)',
      WebkitBackdropFilter: 'blur(24px) saturate(180%)',
      border: '1px solid var(--line-2)', borderRadius: 24,
      padding: '10px 8px', display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4,
      boxShadow: '0 18px 40px rgba(0,0,0,0.55)', zIndex: 40,
    }}>
      {items.map(it => it.fab ? (
        <div key={it.id} onClick={onFab} style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: 999, background: '#0077B6', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 10px 28px rgba(0,119,182,0.55)',
            cursor: 'pointer', transform: 'translateY(-10px)',
          }}><Icon name={it.icon} size={22}/></div>
        </div>
      ) : (
        <div key={it.id} onClick={() => onChange(it.id)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '6px 0', cursor: 'pointer',
            color: active === it.id ? '#4FB3DC' : 'var(--fg-3)', fontSize: 10, fontWeight: 600 }}>
          <Icon name={it.icon} size={22}/>{it.label}
        </div>
      ))}
    </div>
  );
};

// ---- Status bar ----
const StatusBar = ({ time = '9:41' }) => (
  <div style={{
    padding: '16px 28px 6px', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', color: 'white', fontFamily: 'var(--font-sans)',
    fontSize: 15, fontWeight: 600,
  }}>
    <span>{time}</span>
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill="currentColor"/><rect x="4.5" y="5" width="3" height="6" rx="0.6" fill="currentColor"/><rect x="9" y="2" width="3" height="9" rx="0.6" fill="currentColor"/><rect x="13.5" y="0" width="3" height="11" rx="0.6" fill="currentColor"/></svg>
      <svg width="16" height="11" viewBox="0 0 17 12"><path d="M8.5 3.2A9 9 0 0 1 14.4 5.6L15.5 4.5A11 11 0 0 0 8.5 1.5 11 11 0 0 0 1.5 4.5L2.6 5.6A9 9 0 0 1 8.5 3.2z" fill="currentColor"/><circle cx="8.5" cy="10.5" r="1.3" fill="currentColor"/></svg>
      <svg width="24" height="12" viewBox="0 0 25 12"><rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" fill="none" opacity="0.5"/><rect x="2" y="2" width="18" height="8" rx="1.5" fill="currentColor"/><path d="M23 4v4c.8-.3 1.3-1 1.3-2S23.8 4.3 23 4z" fill="currentColor" opacity="0.5"/></svg>
    </div>
  </div>
);

Object.assign(window, {
  Icon, Avatar, AvatarStack, Button, Card, ExpenseRow, TabBar, StatusBar,
  fmtARS, fmtUSD, hueFor,
});
