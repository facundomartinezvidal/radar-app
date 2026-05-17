// RadarScreens.jsx — full screens composed from RadarComponents

// ====== HOME ======
const HomeScreen = ({ onOpenExpense, onOpenGroup }) => (
  <div style={{ paddingBottom: 110 }}>
    {/* Hero — saldo */}
    <div style={{ padding: '8px 20px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>Hola, Facundo</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--fg-1)' }}>Abril 2026</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--bg-2)',
            border: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--fg-2)' }}>
            <Icon name="search" size={18}/>
          </div>
          <div style={{ position: 'relative', width: 40, height: 40, borderRadius: 999, background: 'var(--bg-2)',
            border: '1px solid var(--line-2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--fg-2)' }}>
            <Icon name="bell" size={18}/>
            <div style={{ position: 'absolute', top: 8, right: 10, width: 8, height: 8,
              borderRadius: 999, background: '#EF4444', border: '2px solid var(--bg-0)' }}/>
          </div>
        </div>
      </div>

      <Card style={{ padding: 20, position: 'relative', overflow: 'hidden' }}>
        {/* radar sweep decoration */}
        <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200,
          borderRadius: 999, border: '1px solid rgba(0,119,182,0.15)' }}/>
        <div style={{ position: 'absolute', right: 0, top: 0, width: 120, height: 120,
          borderRadius: 999, border: '1px solid rgba(0,119,182,0.25)' }}/>
        <div style={{ position: 'relative' }}>
          <div className="label" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--fg-3)' }}>Saldo unificado</div>
          <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums', color: 'var(--fg-1)', marginTop: 4 }}>
            <span style={{ color: 'var(--fg-3)', fontWeight: 500, marginRight: 6 }}>$</span>
            248.500<span style={{ color: 'var(--fg-3)', fontWeight: 500 }}>,00</span>
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--line-1)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Te deben</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#34D399', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>+ $ 12.800</div>
            </div>
            <div style={{ width: 1, background: 'var(--line-1)' }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Debés</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F87171', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>− $ 4.200</div>
            </div>
          </div>
        </div>
      </Card>
    </div>

    {/* Billeteras */}
    <div style={{ padding: '0 20px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Tus billeteras</div>
        <div style={{ fontSize: 12, color: 'var(--radar-300)' }}>Ver todas</div>
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
        {[
          { n: 'Mercado Pago', a: '$ 98.400', c: '#00B2FF', cur: 'ARS' },
          { n: 'Ualá', a: '$ 52.100', c: '#FF6B35', cur: 'ARS' },
          { n: 'Santander', a: '$ 82.000', c: '#EC0000', cur: 'ARS' },
          { n: 'Wise USD', a: 'US$ 142,50', c: '#00B9AF', cur: 'USD' },
        ].map((w, i) => (
          <div key={i} style={{
            minWidth: 140, background: 'var(--bg-1)', border: '1px solid var(--line-1)',
            borderRadius: 14, padding: '10px 12px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, background: w.c }}/>
              <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{w.n}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{w.a}</div>
          </div>
        ))}
      </div>
    </div>

    {/* Últimos movimientos */}
    <div style={{ padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Últimos movimientos</div>
        <div style={{ fontSize: 12, color: 'var(--radar-300)' }}>Ver todos</div>
      </div>
      <Card>
        <ExpenseRow icon={{ label: '🍕', bg: 'rgba(0,119,182,0.15)' }} title="Pizza del viernes" sub="Mercado Pago · Hace 2h" amount={4200} type="expense"/>
        <ExpenseRow icon={{ label: 'US', bg: 'rgba(245,158,11,0.18)', c: '#F59E0B' }} title="Spotify Premium" sub="Visa · 3 abr" amount={9.99} currency="USD" type="expense" tag="≈ $ 11.188"/>
        <ExpenseRow icon={{ label: '↓', bg: 'rgba(16,185,129,0.18)', c: '#34D399' }} title="Sueldo abril" sub="Transferencia · 2 abr" amount={820000} type="income"/>
        <ExpenseRow icon={{ label: 'G', bg: 'rgba(139,92,246,0.18)', c: '#A78BFA' }} title="Súper · Roommates" sub="Grupo compartido · Hace 4h" amount={6200} type="expense" tag="tu parte" isLast/>
      </Card>
    </div>
  </div>
);

// ====== EXPENSES (list + filters) ======
const ExpensesScreen = () => {
  const [filter, setFilter] = React.useState('todos');
  const filters = ['todos','comida','transporte','salidas','alquiler'];
  return (
    <div style={{ paddingBottom: 110 }}>
      <div style={{ padding: '8px 20px 12px' }}>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.015em' }}>Gastos</div>
        <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 2 }}>Abril · 47 movimientos</div>
      </div>
      <div style={{ padding: '0 20px 14px', display: 'flex', gap: 8, overflowX: 'auto' }}>
        {filters.map(f => (
          <div key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 14px', borderRadius: 999, fontSize: 12, fontWeight: 500,
            textTransform: 'capitalize', flexShrink: 0, cursor: 'pointer',
            background: filter === f ? 'rgba(0,119,182,0.18)' : 'var(--bg-2)',
            color: filter === f ? '#9DD5F0' : 'var(--fg-2)',
            border: filter === f ? '1px solid rgba(0,119,182,0.45)' : '1px solid var(--line-2)',
          }}>{f}</div>
        ))}
      </div>
      <div style={{ padding: '0 20px' }}>
        {[
          { h: 'Hoy', items: [
            { i: '🍕', t: 'Pizza del viernes', s: 'Mercado Pago · 22:14', a: 4200 },
            { i: '🚕', t: 'Uber · Palermo', s: 'Visa · 19:30', a: 2800 },
          ]},
          { h: 'Ayer', items: [
            { i: '☕', t: 'Cafecito Starbucks', s: 'Mercado Pago', a: 3100 },
            { i: 'US', t: 'Spotify', s: 'Visa', a: 9.99, cur: 'USD', tag: '≈ $ 11.188' },
            { i: '🛒', t: 'Changuito · Carrefour', s: 'Ualá', a: 28400 },
          ]},
          { h: 'Lunes 14', items: [
            { i: '🏠', t: 'Alquiler abril', s: 'Transferencia · Inaki', a: 180000 },
          ]},
        ].map((sec, si) => (
          <div key={si} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--fg-3)', padding: '0 4px 6px' }}>{sec.h}</div>
            <Card>
              {sec.items.map((it, ii) => (
                <ExpenseRow key={ii} icon={{ label: it.i, bg: 'var(--bg-3)' }}
                  title={it.t} sub={it.s} amount={it.a} currency={it.cur || 'ARS'} tag={it.tag}
                  type="expense" isLast={ii === sec.items.length - 1}/>
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};

// ====== GROUPS ======
const GroupsScreen = ({ onOpenGroup }) => (
  <div style={{ paddingBottom: 110 }}>
    <div style={{ padding: '8px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
      <div>
        <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.015em' }}>Grupos</div>
        <div style={{ fontSize: 13, color: 'var(--fg-3)', marginTop: 2 }}>Gastos compartidos</div>
      </div>
      <Button variant="primary" size="sm" icon="plus">Nuevo</Button>
    </div>
    <div style={{ padding: '0 20px' }}>
      {[
        { name: 'Roommates', members: ['Facundo M','Jonathan M','Inaki M','Ana P','Sofi R'], bal: -6200, count: 3 },
        { name: 'Viaje Bariloche', members: ['Facundo M','Jonathan M','Inaki M'], bal: 24800, count: 12 },
        { name: 'Cena sábado', members: ['Facundo M','Ana P','Sofi R','Mateo L'], bal: 0, count: 1, saldada: true },
      ].map((g, i) => (
        <Card key={i} style={{ padding: 16, marginBottom: 10, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>{g.members.length} personas · {g.count} {g.count === 1 ? 'gasto' : 'gastos'}</div>
              <div style={{ marginTop: 10 }}><AvatarStack names={g.members} max={4}/></div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {g.saldada ? (
                <div style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999,
                  background: 'rgba(16,185,129,0.18)', color: '#34D399', fontSize: 11, fontWeight: 600 }}>Saldada</div>
              ) : (
                <>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {g.bal > 0 ? 'Te deben' : 'Debés'}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                    color: g.bal > 0 ? '#34D399' : '#F87171', marginTop: 2 }}>
                    {g.bal > 0 ? '+' : '−'} $ {Math.abs(g.bal).toLocaleString('es-AR')}
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  </div>
);

// ====== PROFILE ======
const ProfileScreen = () => (
  <div style={{ paddingBottom: 110 }}>
    <div style={{ padding: '8px 20px 20px' }}>
      <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.015em' }}>Perfil</div>
    </div>
    <div style={{ padding: '0 20px' }}>
      <Card style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <Avatar name="Facundo Martínez" size={60}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>Facundo Martínez</div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>fmartinezvidal@uade.edu.ar</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-2)', marginTop: 4 }}>facu.radar</div>
        </div>
      </Card>

      {[
        { title: 'Integraciones', rows: [
          { i: 'wallet', l: 'Billeteras conectadas', r: '4' },
          { i: 'whatsapp', l: 'WhatsApp Bot', r: 'Activo' },
        ]},
        { title: 'Preferencias', rows: [
          { i: 'dollar', l: 'Moneda principal', r: 'ARS' },
          { i: 'trend', l: 'Tipo de cambio', r: 'Blue' },
          { i: 'bell', l: 'Notificaciones', r: 'On' },
        ]},
        { title: 'Cuenta', rows: [
          { i: 'settings', l: 'Configuración' },
          { i: 'close', l: 'Cerrar sesión', danger: true },
        ]},
      ].map((sec, si) => (
        <div key={si} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--fg-3)', padding: '0 4px 6px' }}>{sec.title}</div>
          <Card>
            {sec.rows.map((r, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                borderBottom: i === sec.rows.length - 1 ? 'none' : '1px solid var(--line-1)',
                color: r.danger ? '#F87171' : 'var(--fg-1)',
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--bg-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: r.danger ? '#F87171' : 'var(--radar-300)' }}>
                  <Icon name={r.i} size={16}/>
                </div>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{r.l}</div>
                {r.r && <div style={{ fontSize: 12, color: 'var(--fg-3)' }}>{r.r}</div>}
                {!r.danger && <div style={{ color: 'var(--fg-4)' }}><Icon name="chevR" size={14}/></div>}
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  </div>
);

// ====== ADD EXPENSE SHEET ======
const AddExpenseSheet = ({ onClose, onSave }) => {
  const [amount, setAmount] = React.useState('0');
  const [cur, setCur] = React.useState('ARS');
  const [desc, setDesc] = React.useState('');
  const [cat, setCat] = React.useState(null);
  const cats = [
    { k: 'comida', l: 'Comida', e: '🍔' },
    { k: 'transporte', l: 'Transporte', e: '🚕' },
    { k: 'salidas', l: 'Salidas', e: '🍻' },
    { k: 'super', l: 'Súper', e: '🛒' },
    { k: 'alquiler', l: 'Alquiler', e: '🏠' },
    { k: 'susc', l: 'Suscripciones', e: '▶' },
  ];
  const press = (k) => {
    if (k === 'del') setAmount(a => a.length > 1 ? a.slice(0, -1) : '0');
    else if (k === '.') { if (!amount.includes(',')) setAmount(a => a + ','); }
    else setAmount(a => a === '0' ? String(k) : a + k);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column',
      background: 'rgba(10,15,26,0.6)', backdropFilter: 'blur(8px)' }}>
      <div style={{ flex: 1 }} onClick={onClose}/>
      <div style={{ background: 'var(--bg-1)', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: '12px 20px 34px', borderTop: '1px solid var(--line-2)',
        boxShadow: '0 -24px 60px rgba(0,0,0,0.6)', animation: 'slideUp 320ms var(--ease-out)' }}>
        <div style={{ width: 36, height: 4, background: 'var(--line-3)', borderRadius: 4, margin: '0 auto 18px' }}/>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Nuevo gasto</div>
          <div onClick={onClose} style={{ color: 'var(--fg-3)', cursor: 'pointer' }}>
            <Icon name="close" size={20}/>
          </div>
        </div>

        {/* Currency toggle */}
        <div style={{ display: 'flex', gap: 0, background: 'var(--bg-3)', padding: 3, borderRadius: 10, marginBottom: 14, width: 120 }}>
          {['ARS','USD'].map(c => (
            <div key={c} onClick={() => setCur(c)} style={{
              flex: 1, padding: '6px 0', textAlign: 'center', fontSize: 12, fontWeight: 600,
              borderRadius: 7, fontFamily: 'var(--font-mono)', cursor: 'pointer',
              background: cur === c ? '#0077B6' : 'transparent',
              color: cur === c ? 'white' : 'var(--fg-3)',
            }}>{c === 'ARS' ? '$' : 'US$'}</div>
          ))}
        </div>

        {/* Amount display */}
        <div style={{ textAlign: 'center', padding: '10px 0 16px' }}>
          <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Monto</div>
          <div style={{ fontSize: 48, fontWeight: 700, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
            <span style={{ color: 'var(--fg-3)', fontWeight: 500, marginRight: 4 }}>{cur === 'ARS' ? '$' : 'US$'}</span>
            {amount}
          </div>
          {cur === 'USD' && amount !== '0' && (
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>≈ $ {(parseFloat(amount.replace(',','.')) * 1120).toLocaleString('es-AR', { maximumFractionDigits: 0 })} ARS</div>
          )}
        </div>

        {/* Description */}
        <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="¿En qué gastaste?"
          style={{ width: '100%', background: 'var(--bg-2)', border: '1px solid var(--line-2)',
            borderRadius: 14, padding: '12px 14px', color: 'var(--fg-1)', fontSize: 15,
            fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box', outline: 'none' }}/>

        {/* Categories */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6, marginBottom: 14 }}>
          {cats.map(c => (
            <div key={c.k} onClick={() => setCat(c.k)} style={{
              background: cat === c.k ? 'rgba(0,119,182,0.18)' : 'var(--bg-2)',
              border: cat === c.k ? '1px solid rgba(0,119,182,0.5)' : '1px solid var(--line-2)',
              borderRadius: 12, padding: '10px 4px', textAlign: 'center', cursor: 'pointer',
            }}>
              <div style={{ fontSize: 18 }}>{c.e}</div>
              <div style={{ fontSize: 9, color: 'var(--fg-3)', marginTop: 2 }}>{c.l}</div>
            </div>
          ))}
        </div>

        <Button variant="primary" size="lg" full onClick={() => onSave({ amount, cur, desc, cat })}>
          Registrar gasto
        </Button>
      </div>
    </div>
  );
};

Object.assign(window, { HomeScreen, ExpensesScreen, GroupsScreen, ProfileScreen, AddExpenseSheet });
