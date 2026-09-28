import { BookOpen, X } from 'lucide-react';
type Props={open:boolean;onClose:()=>void};
const problems=[
 ['11','سلم طوله 10m يستند على حائط…','https://xutqrhwqrodzmbdlgqsg.supabase.co/storage/v1/object/public/exam-diagrams/exam_diagrams/page_1_p1_q11_fig_02_diagram_geometric.png'],
 ['19','عمود طوله 7.2m وفي نهايته مصباح…','https://xutqrhwqrodzmbdlgqsg.supabase.co/storage/v1/object/public/exam-diagrams/exam_diagrams/page_2_p2_q19_fig_diagram_geometric.png'],
 ['20','فنار ميناء ارتفاعه 20m…','https://xutqrhwqrodzmbdlgqsg.supabase.co/storage/v1/object/public/exam-diagrams/exam_diagrams/page_2_p2_q20_fig_diagram_geometric.png'],
 ['21','مصدر ضوئي يبعد 20m عن الحائط…','https://xutqrhwqrodzmbdlgqsg.supabase.co/storage/v1/object/public/exam-diagrams/exam_diagrams/page_3_p3_q21_fig1_diagram_chart_geometric.png'],
 ['22','خزان مخروطي يصب فيه سائل…','https://xutqrhwqrodzmbdlgqsg.supabase.co/storage/v1/object/public/exam-diagrams/exam_diagrams/page_3_p3_q22_fig1_diagram_geometric.png'],
 ['23','احسب معدل تغير نصف قطر السائل…','https://xutqrhwqrodzmbdlgqsg.supabase.co/storage/v1/object/public/exam-diagrams/exam_diagrams/page_3_p3_q23_fig1_diagram_geometric.png']
];
export function CurriculumDrawer({open,onClose}:Props){return <div className={`drawer ${open?'drawer-open':''}`} aria-hidden={!open}><div className="drawer-head"><div><span className="eyebrow">دفتر التعلّم</span><h2><BookOpen size={22}/> مسائل معدلات التغير</h2></div><button className="icon-button" onClick={onClose} aria-label="إغلاق"><X/></button></div><p className="drawer-copy">ست مسائل حقيقية من الملف المرفوع، مع الرسومات الأصلية.</p><div className="problem-grid">{problems.map(([n,t,img])=><article className="problem-card" key={n}><img src={img} alt="رسم المسألة"/><div><span>سؤال {n}</span><p>{t}</p><button>نحلّها سوا</button></div></article>)}</div></div>}
