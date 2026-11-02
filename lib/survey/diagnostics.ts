// Universal Technical Survey — Phase 2: device/OS-aware diagnostic engine.
//
// Principles (from the spec):
//  - Never assume the OS from the device — only procedures matching the CONFIRMED os_family are offered.
//  - Prefer the simplest reliable method: system/GUI → built-in commands → CLI → vendor → external → specialist.
//  - Every procedure carries purpose, exact numbered steps, expected result/acceptance, interpretation,
//    limitations, required privilege, service impact, an authoritative source and a verification date.
//  - Nothing here invents commands or numeric thresholds; interpretations stay qualitative and ask the
//    technician to RECORD measured values. Anything that varies by version/hardware is marked needs_review
//    so it is never auto-recommended as an approved standard.
//  - Only non-destructive, read-only diagnostics live here. Destructive/data actions are gated elsewhere.

export type MethodTier = 'gui' | 'observation' | 'builtin_cmd' | 'powershell' | 'terminal' | 'vendor' | 'bios' | 'external' | 'specialist';
export type ProcStatus = 'approved' | 'needs_review';
export type Privilege = 'none' | 'admin' | 'root';
export type Impact = 'none' | 'modifies' | 'service';
type L = { ar: string; en: string };

export interface DiagProc {
    id: string;
    ar: string; en: string;              // short task name
    categories: string[];                // asset categories, or ['any']
    os: string[];                        // os_family keys, or ['any']
    purpose: L;
    tier: MethodTier;
    app?: L;                             // application/tool to open
    command?: string;                    // copyable command, when applicable
    steps: L[];                          // short, explicit, numbered steps
    expected: L;                         // expected output / acceptance criterion
    interpretation: L;
    limitations?: L;
    privilege: Privilege;
    impact: Impact;
    record: 'result' | 'measurement';    // measurement => a measured value must be recorded to pass
    source: string;                      // authoritative source reference
    verified_on: string;                 // ISO date of verification
    status: ProcStatus;
}

const DATE = '2026-10-29';

const TIER_ORDER: MethodTier[] = ['gui', 'observation', 'builtin_cmd', 'powershell', 'terminal', 'vendor', 'bios', 'external', 'specialist'];

export const TIER_LABEL: Record<MethodTier, L> = {
    gui: { ar: 'واجهة رسومية', en: 'GUI' },
    observation: { ar: 'ملاحظة مباشرة', en: 'Observation' },
    builtin_cmd: { ar: 'أمر مدمج', en: 'Built-in command' },
    powershell: { ar: 'PowerShell', en: 'PowerShell' },
    terminal: { ar: 'Terminal', en: 'Terminal' },
    vendor: { ar: 'أداة الشركة المصنّعة', en: 'Vendor tool' },
    bios: { ar: 'BIOS/UEFI', en: 'BIOS/UEFI' },
    external: { ar: 'أداة خارجية معتمدة', en: 'Approved external tool' },
    specialist: { ar: 'يتطلب أخصائياً', en: 'Specialist required' },
};

// Shown whenever the asset's OS is not yet confirmed — guides identification, never guesses.
export const IDENTIFY_OS: DiagProc = {
    id: 'identify_os',
    ar: 'تحديد نظام التشغيل', en: 'Identify the operating system',
    categories: ['any'], os: ['any'],
    purpose: { ar: 'تأكيد النظام الفعلي قبل عرض أي اختبار خاص به.', en: 'Confirm the actual OS before showing any OS-specific test.' },
    tier: 'gui',
    steps: [
        { ar: 'شغّل الجهاز وانتظر حتى يكتمل الإقلاع.', en: 'Power on the device and wait for it to finish booting.' },
        { ar: 'في ويندوز: افتح Settings ثم System ثم About، أو اكتب winver في بحث ويندوز.', en: 'Windows: open Settings → System → About, or type winver in search.' },
        { ar: 'في الماك: من قائمة Apple اختر About This Mac.', en: 'Mac: Apple menu → About This Mac.' },
        { ar: 'في لينكس: افتح Terminal واكتب الأمر cat /etc/os-release.', en: 'Linux: open Terminal and run cat /etc/os-release.' },
        { ar: 'سجّل اسم النظام وإصداره في خانة «نظام التشغيل» و«الإصدار» ببيانات الجهاز بالأعلى.', en: 'Record the OS name and version in the asset fields above.' },
    ],
    expected: { ar: 'ظهور اسم النظام ورقم الإصدار بوضوح.', en: 'OS name and version are clearly shown.' },
    interpretation: { ar: 'بعد التأكيد ستظهر اختبارات النظام المناسبة تلقائياً.', en: 'Once confirmed, the matching OS tests appear automatically.' },
    privilege: 'none', impact: 'none', record: 'measurement',
    source: 'Microsoft / Apple / Linux vendor documentation (built-in)', verified_on: DATE, status: 'approved',
};

// Helper to keep entries terse with sane defaults.
const p = (d: Partial<DiagProc> & Pick<DiagProc, 'id' | 'ar' | 'en' | 'categories' | 'os' | 'purpose' | 'tier' | 'steps' | 'expected' | 'interpretation' | 'record' | 'source'>): DiagProc => ({
    privilege: 'none', impact: 'none', status: 'approved', verified_on: DATE, ...d,
});

const PC = ['windows_pc', 'laptop', 'aio'];

export const PROCS: DiagProc[] = [
    // ── Windows ──
    p({
        id: 'win_version', ar: 'إصدار Windows', en: 'Windows version', categories: [...PC, 'server'], os: ['windows'], tier: 'gui',
        purpose: { ar: 'توثيق إصدار النظام لاختيار الإجراءات المناسبة.', en: 'Record the Windows edition/version.' },
        app: { ar: 'الإعدادات', en: 'Settings' },
        steps: [
            { ar: 'افتح Settings ثم System ثم About.', en: 'Open Settings → System → About.' },
            { ar: 'سجّل «Edition» و«Version» و«OS build».', en: 'Record Edition, Version and OS build.' },
        ],
        expected: { ar: 'ظهور الإصدار ورقم البناء.', en: 'Edition and build are shown.' },
        interpretation: { ar: 'سجّل القيم كما ظهرت دون تفسير إضافي.', en: 'Record the values as shown.' },
        record: 'measurement', source: 'Microsoft Learn: winver / Settings > About',
    }),
    p({
        id: 'win_storage', ar: 'سعة التخزين (Windows)', en: 'Storage capacity (Windows)', categories: [...PC, 'server', 'storage'], os: ['windows'], tier: 'gui',
        purpose: { ar: 'معرفة السعة الكلية والمتاحة.', en: 'Read total/free storage.' },
        app: { ar: 'الإعدادات', en: 'Settings' },
        steps: [
            { ar: 'افتح Settings ثم System ثم Storage.', en: 'Open Settings → System → Storage.' },
            { ar: 'سجّل السعة الكلية والمساحة المتاحة لكل قرص.', en: 'Record total and free space per drive.' },
        ],
        expected: { ar: 'ظهور السعة والمساحة المتاحة.', en: 'Total and free space shown.' },
        interpretation: { ar: 'امتلاء القرص قرب الحد الأقصى قد يؤثر على الأداء — سجّل القيم.', en: 'A near-full disk may affect performance — record the values.' },
        record: 'measurement', source: 'Microsoft Learn: Settings > System > Storage',
    }),
    p({
        id: 'win_disk_check', ar: 'فحص سلامة القرص (قراءة فقط)', en: 'Disk check (read-only)', categories: [...PC, 'server', 'storage'], os: ['windows'], tier: 'builtin_cmd',
        purpose: { ar: 'فحص أخطاء نظام الملفات دون إصلاح.', en: 'Scan the file system for errors without repairing.' },
        app: { ar: 'موجّه الأوامر', en: 'Command Prompt' }, command: 'chkdsk C:',
        steps: [
            { ar: 'افتح Command Prompt.', en: 'Open Command Prompt.' },
            { ar: 'اكتب الأمر: chkdsk C: ثم اضغط Enter (بدون /f فهو فحص قراءة فقط).', en: 'Run: chkdsk C: (no /f = read-only).' },
            { ar: 'سجّل أي أخطاء يذكرها التقرير.', en: 'Record any errors reported.' },
        ],
        expected: { ar: 'تقرير يفيد بعدم وجود مشاكل، أو يذكر الأخطاء.', en: 'Report states no problems, or lists errors.' },
        interpretation: { ar: 'وجود أخطاء يستوجب مراجعة قبل أي إصلاح — لا تشغّل /f إلا بتفويض.', en: 'Errors require review before any repair — do not run /f without authorization.' },
        limitations: { ar: 'لا يُصلح الأخطاء؛ للإصلاح يلزم تفويض وإجراء منفصل.', en: 'Does not repair; repair needs authorization and a separate procedure.' },
        record: 'result', source: 'Microsoft Learn: chkdsk',
    }),
    p({
        id: 'win_memory', ar: 'الذاكرة (RAM)', en: 'Memory (RAM)', categories: [...PC, 'server'], os: ['windows'], tier: 'gui',
        purpose: { ar: 'معرفة حجم الذاكرة ونسبة استخدامها.', en: 'Read installed RAM and usage.' },
        app: { ar: 'إدارة المهام', en: 'Task Manager' },
        steps: [
            { ar: 'اضغط Ctrl+Shift+Esc لفتح Task Manager.', en: 'Press Ctrl+Shift+Esc to open Task Manager.' },
            { ar: 'افتح تبويب Performance ثم Memory.', en: 'Open Performance → Memory.' },
            { ar: 'سجّل الحجم الكلي والمستخدم.', en: 'Record total and in-use memory.' },
        ],
        expected: { ar: 'ظهور الحجم الكلي والاستخدام.', en: 'Total and usage shown.' },
        interpretation: { ar: 'استخدام مرتفع دائم قد يشير لنقص الذاكرة — سجّل القيم.', en: 'Persistently high usage may indicate low memory — record values.' },
        record: 'measurement', source: 'Microsoft Learn: Task Manager Performance tab',
    }),
    p({
        id: 'win_network', ar: 'الاتصال بالشبكة (Windows)', en: 'Network connectivity (Windows)', categories: [...PC, 'server'], os: ['windows'], tier: 'builtin_cmd',
        purpose: { ar: 'التأكد من إعدادات الشبكة والوصول للإنترنت.', en: 'Verify network config and internet reachability.' },
        app: { ar: 'موجّه الأوامر', en: 'Command Prompt' }, command: 'ipconfig /all & ping 8.8.8.8',
        steps: [
            { ar: 'افتح Command Prompt.', en: 'Open Command Prompt.' },
            { ar: 'اكتب ipconfig /all وسجّل عنوان IP والبوابة.', en: 'Run ipconfig /all; record IP and gateway.' },
            { ar: 'اكتب ping 8.8.8.8 وسجّل نسبة الفقد وزمن الرد.', en: 'Run ping 8.8.8.8; record loss % and reply time.' },
        ],
        expected: { ar: 'وصول الرد مع فقد 0%.', en: 'Replies received with 0% loss.' },
        interpretation: { ar: 'فقد 0% ووصول الرد = الاتصال سليم؛ أي فقد يحتاج مراجعة.', en: '0% loss with replies = healthy; any loss needs review.' },
        record: 'result', source: 'Microsoft Learn: ipconfig, ping',
    }),
    p({
        id: 'win_battery', ar: 'تقرير البطارية (لابتوب)', en: 'Battery report (laptop)', categories: ['laptop'], os: ['windows'], tier: 'builtin_cmd',
        purpose: { ar: 'قياس تآكل البطارية.', en: 'Measure battery wear.' },
        app: { ar: 'موجّه الأوامر', en: 'Command Prompt' }, command: 'powercfg /batteryreport /output "%USERPROFILE%\\battery-report.html"',
        steps: [
            { ar: 'افتح Command Prompt.', en: 'Open Command Prompt.' },
            { ar: 'نفّذ الأمر المعروض لإنشاء التقرير.', en: 'Run the command to generate the report.' },
            { ar: 'افتح الملف battery-report.html وسجّل «Design Capacity» و«Full Charge Capacity».', en: 'Open battery-report.html; record Design Capacity and Full Charge Capacity.' },
        ],
        expected: { ar: 'إنشاء التقرير وظهور القيمتين.', en: 'Report created; both values shown.' },
        interpretation: { ar: 'انخفاض السعة الكاملة بوضوح عن سعة التصميم يدل على تآكل البطارية — سجّل القيمتين دون افتراض نسبة.', en: 'A full-charge capacity clearly below design capacity indicates wear — record both values; do not assume a threshold.' },
        record: 'measurement', source: 'Microsoft Learn: powercfg /batteryreport',
    }),
    p({
        id: 'win_events', ar: 'مراجعة سجل الأحداث', en: 'Event log review', categories: [...PC, 'server'], os: ['windows'], tier: 'gui',
        purpose: { ar: 'رصد الأخطاء الحرجة المتكررة.', en: 'Spot recurring critical errors.' },
        app: { ar: 'عارض الأحداث', en: 'Event Viewer' },
        steps: [
            { ar: 'افتح Event Viewer.', en: 'Open Event Viewer.' },
            { ar: 'ادخل Windows Logs ثم System، وصفِّ على Error/Critical.', en: 'Go to Windows Logs → System; filter Error/Critical.' },
            { ar: 'سجّل أي أخطاء متكررة حديثة.', en: 'Record any recent recurring errors.' },
        ],
        expected: { ar: 'قائمة بالأخطاء إن وُجدت.', en: 'A list of errors if present.' },
        interpretation: { ar: 'تكرار نفس الخطأ يستدعي مراجعة متخصصة.', en: 'A repeating error warrants specialist review.' },
        record: 'result', source: 'Microsoft Learn: Event Viewer',
    }),

    // ── Linux ──
    p({
        id: 'linux_version', ar: 'توزيعة وإصدار Linux', en: 'Linux distribution & version', categories: ['linux', 'server'], os: ['linux'], tier: 'terminal',
        purpose: { ar: 'تأكيد التوزيعة والإصدار الفعليين.', en: 'Confirm the actual distribution/version.' },
        app: { ar: 'Terminal', en: 'Terminal' }, command: 'cat /etc/os-release',
        steps: [
            { ar: 'افتح Terminal.', en: 'Open Terminal.' },
            { ar: 'نفّذ cat /etc/os-release.', en: 'Run cat /etc/os-release.' },
            { ar: 'سجّل NAME و VERSION.', en: 'Record NAME and VERSION.' },
        ],
        expected: { ar: 'ظهور اسم التوزيعة والإصدار.', en: 'Distribution name and version shown.' },
        interpretation: { ar: 'سجّل القيم كما ظهرت.', en: 'Record the values as shown.' },
        record: 'measurement', source: 'Linux man-pages / os-release(5)',
    }),
    p({
        id: 'linux_disk', ar: 'التخزين (Linux)', en: 'Storage (Linux)', categories: ['linux', 'server', 'storage'], os: ['linux'], tier: 'terminal',
        purpose: { ar: 'معرفة السعة والأقراص.', en: 'Read capacity and block devices.' },
        app: { ar: 'Terminal', en: 'Terminal' }, command: 'df -h && lsblk',
        steps: [
            { ar: 'نفّذ df -h وسجّل الاستخدام لكل قسم.', en: 'Run df -h; record usage per partition.' },
            { ar: 'نفّذ lsblk وسجّل الأقراص.', en: 'Run lsblk; record the disks.' },
        ],
        expected: { ar: 'ظهور الأقسام والاستخدام.', en: 'Partitions and usage shown.' },
        interpretation: { ar: 'امتلاء قسم قرب 100% يحتاج معالجة — سجّل القيم.', en: 'A partition near 100% needs attention — record values.' },
        record: 'measurement', source: 'Linux man-pages: df(1), lsblk(8)',
    }),
    p({
        id: 'linux_memory', ar: 'الذاكرة (Linux)', en: 'Memory (Linux)', categories: ['linux', 'server'], os: ['linux'], tier: 'terminal',
        purpose: { ar: 'قراءة الذاكرة المتاحة والمستخدمة.', en: 'Read used/available memory.' },
        app: { ar: 'Terminal', en: 'Terminal' }, command: 'free -h',
        steps: [
            { ar: 'نفّذ free -h.', en: 'Run free -h.' },
            { ar: 'سجّل total و used و available.', en: 'Record total, used, available.' },
        ],
        expected: { ar: 'ظهور قيم الذاكرة.', en: 'Memory values shown.' },
        interpretation: { ar: 'سجّل القيم؛ انخفاض available الدائم يستدعي مراجعة.', en: 'Record values; persistently low available needs review.' },
        record: 'measurement', source: 'Linux man-pages: free(1)',
    }),
    p({
        id: 'linux_network', ar: 'الاتصال بالشبكة (Linux)', en: 'Network connectivity (Linux)', categories: ['linux', 'server'], os: ['linux'], tier: 'terminal',
        purpose: { ar: 'التأكد من العنوان والوصول للإنترنت.', en: 'Verify addressing and reachability.' },
        app: { ar: 'Terminal', en: 'Terminal' }, command: 'ip addr && ping -c 4 8.8.8.8',
        steps: [
            { ar: 'نفّذ ip addr وسجّل عنوان IP.', en: 'Run ip addr; record the IP.' },
            { ar: 'نفّذ ping -c 4 8.8.8.8 وسجّل الفقد.', en: 'Run ping -c 4 8.8.8.8; record loss.' },
        ],
        expected: { ar: 'وصول الرد بفقد 0%.', en: 'Replies with 0% loss.' },
        interpretation: { ar: 'فقد 0% = سليم؛ أي فقد يحتاج مراجعة.', en: '0% loss = healthy; any loss needs review.' },
        record: 'result', source: 'Linux man-pages: ip(8), ping(8)',
    }),
    p({
        id: 'linux_smart', ar: 'صحة القرص SMART (Linux)', en: 'Disk SMART health (Linux)', categories: ['linux', 'server', 'storage'], os: ['linux'], tier: 'external',
        purpose: { ar: 'قراءة مؤشرات صحة القرص.', en: 'Read disk SMART health attributes.' },
        app: { ar: 'smartmontools', en: 'smartmontools' }, command: 'sudo smartctl -a /dev/sdX',
        steps: [
            { ar: 'تأكد من تثبيت smartmontools.', en: 'Ensure smartmontools is installed.' },
            { ar: 'استبدل sdX بالقرص الصحيح من lsblk.', en: 'Replace sdX with the correct disk from lsblk.' },
            { ar: 'نفّذ الأمر بصلاحية root وسجّل الحالة العامة وأي سمات تحذيرية.', en: 'Run as root; record overall health and any warning attributes.' },
        ],
        expected: { ar: 'ظهور «SMART overall-health» وقيم السمات.', en: 'SMART overall-health and attribute values shown.' },
        interpretation: { ar: 'قراءة السمات تختلف حسب الطراز — لا تعتمد نتيجة نهائية بدون مراجعة متخصص.', en: 'Attribute meaning varies by model — do not finalize without specialist review.' },
        limitations: { ar: 'يتطلب تثبيت أداة خارجية وصلاحية root ومعرفة الطراز.', en: 'Requires an external tool, root, and model knowledge.' },
        privilege: 'root', record: 'result', source: 'smartmontools documentation', status: 'needs_review',
    }),

    // ── macOS ──
    p({
        id: 'mac_version', ar: 'إصدار macOS', en: 'macOS version', categories: ['macbook', 'aio'], os: ['macos'], tier: 'gui',
        purpose: { ar: 'توثيق إصدار النظام والطراز.', en: 'Record the macOS version and model.' },
        app: { ar: 'About This Mac', en: 'About This Mac' },
        steps: [
            { ar: 'من قائمة Apple اختر About This Mac.', en: 'Apple menu → About This Mac.' },
            { ar: 'سجّل اسم وإصدار macOS والطراز.', en: 'Record macOS name/version and model.' },
        ],
        expected: { ar: 'ظهور الإصدار والطراز.', en: 'Version and model shown.' },
        interpretation: { ar: 'سجّل القيم كما ظهرت.', en: 'Record values as shown.' },
        record: 'measurement', source: 'Apple Support: About This Mac',
    }),
    p({
        id: 'mac_storage', ar: 'التخزين (macOS)', en: 'Storage (macOS)', categories: ['macbook', 'aio'], os: ['macos'], tier: 'gui',
        purpose: { ar: 'معرفة السعة والمساحة المتاحة.', en: 'Read capacity and free space.' },
        app: { ar: 'About This Mac', en: 'About This Mac' },
        steps: [
            { ar: 'من About This Mac افتح More Info ثم Storage (أو Settings > General > Storage).', en: 'About This Mac → More Info → Storage (or Settings → General → Storage).' },
            { ar: 'سجّل السعة الكلية والمتاحة.', en: 'Record total and free space.' },
        ],
        expected: { ar: 'ظهور السعة والمتاح.', en: 'Capacity and free shown.' },
        interpretation: { ar: 'امتلاء القرص قد يؤثر على الأداء — سجّل القيم.', en: 'A near-full disk may affect performance — record values.' },
        record: 'measurement', source: 'Apple Support: Storage',
    }),
    p({
        id: 'mac_memory', ar: 'الذاكرة (macOS)', en: 'Memory (macOS)', categories: ['macbook', 'aio'], os: ['macos'], tier: 'gui',
        purpose: { ar: 'متابعة ضغط/استخدام الذاكرة.', en: 'Check memory pressure/usage.' },
        app: { ar: 'Activity Monitor', en: 'Activity Monitor' },
        steps: [
            { ar: 'افتح Activity Monitor ثم تبويب Memory.', en: 'Open Activity Monitor → Memory.' },
            { ar: 'سجّل Memory Used وMemory Pressure.', en: 'Record Memory Used and Memory Pressure.' },
        ],
        expected: { ar: 'ظهور الاستخدام ومؤشر الضغط.', en: 'Usage and pressure shown.' },
        interpretation: { ar: 'ضغط ذاكرة أحمر مستمر يستدعي مراجعة.', en: 'Sustained red memory pressure needs review.' },
        record: 'measurement', source: 'Apple Support: Activity Monitor',
    }),
    p({
        id: 'mac_network', ar: 'الاتصال بالشبكة (macOS)', en: 'Network connectivity (macOS)', categories: ['macbook', 'aio'], os: ['macos'], tier: 'terminal',
        purpose: { ar: 'التأكد من الوصول للإنترنت.', en: 'Verify internet reachability.' },
        app: { ar: 'Terminal', en: 'Terminal' }, command: 'ping -c 4 8.8.8.8',
        steps: [
            { ar: 'افتح Terminal ونفّذ الأمر.', en: 'Open Terminal and run the command.' },
            { ar: 'سجّل نسبة الفقد وزمن الرد.', en: 'Record loss % and reply time.' },
        ],
        expected: { ar: 'وصول الرد بفقد 0%.', en: 'Replies with 0% loss.' },
        interpretation: { ar: 'فقد 0% = سليم؛ أي فقد يحتاج مراجعة.', en: '0% loss = healthy; any loss needs review.' },
        record: 'result', source: 'Apple / BSD man-pages: ping(8)',
    }),
    p({
        id: 'mac_apple_diagnostics', ar: 'Apple Diagnostics (فحص العتاد)', en: 'Apple Diagnostics (hardware)', categories: ['macbook', 'aio'], os: ['macos'], tier: 'vendor',
        purpose: { ar: 'فحص عتاد الماك باستخدام أداة Apple.', en: 'Run Apple hardware diagnostics.' },
        steps: [
            { ar: 'افصل الملحقات غير الضرورية واترك الطاقة موصّلة.', en: 'Disconnect non-essential peripherals; keep power connected.' },
            { ar: 'أكّد أولاً نوع المعالج (Intel أو Apple Silicon) من About This Mac.', en: 'First confirm the chip (Intel vs Apple Silicon) from About This Mac.' },
            { ar: 'اتبع طريقة الإقلاع المطابقة لنوع المعالج لتشغيل Apple Diagnostics، وسجّل أي أكواد.', en: 'Use the startup method matching the chip to launch Apple Diagnostics; record any codes.' },
        ],
        expected: { ar: 'انتهاء الفحص وظهور «لا توجد مشاكل» أو أكواد مرجعية.', en: 'Finishes with "no issues" or reference codes.' },
        interpretation: { ar: 'طريقة الإقلاع تختلف بين Intel وApple Silicon — تحقّق قبل التنفيذ ولا تعتمد كمعيار تلقائي.', en: 'The startup method differs between Intel and Apple Silicon — verify first; not an auto-standard.' },
        limitations: { ar: 'يتطلب إعادة تشغيل وتوقف الجهاز عن العمل أثناء الفحص.', en: 'Requires a reboot; the device is unavailable during the test.' },
        impact: 'service', record: 'result', source: 'Apple Support: Apple Diagnostics', status: 'needs_review',
    }),

    // ── Printers ──
    p({
        id: 'printer_test_page', ar: 'طباعة صفحة اختبار', en: 'Print a test page', categories: ['printer'], os: ['any'], tier: 'gui',
        purpose: { ar: 'التأكد من الطباعة وجودتها.', en: 'Verify printing and quality.' },
        app: { ar: 'لوحة الطابعة / إعدادات ويندوز', en: 'Printer panel / Windows settings' },
        steps: [
            { ar: 'من لوحة الطابعة أو من Settings > Printers اختر الطابعة.', en: 'From the printer panel or Settings → Printers select the printer.' },
            { ar: 'اطبع صفحة اختبار (Print Test Page).', en: 'Print a test page.' },
            { ar: 'افحص وضوح الطباعة وأي خطوط/بقع.', en: 'Inspect clarity and any streaks/marks.' },
        ],
        expected: { ar: 'طباعة واضحة بلا عيوب.', en: 'A clear page with no defects.' },
        interpretation: { ar: 'خطوط/بهتان قد يشير لمشكلة حبر/رأس طباعة — سجّل الوصف.', en: 'Streaks/fading may indicate ink/printhead issues — record a description.' },
        record: 'result', source: 'Microsoft Learn / printer vendor manual',
    }),
    p({
        id: 'printer_consumables', ar: 'مستوى المستهلكات', en: 'Consumables level', categories: ['printer'], os: ['any'], tier: 'observation',
        purpose: { ar: 'معرفة مستوى الحبر/التونر.', en: 'Read ink/toner level.' },
        steps: [
            { ar: 'من شاشة الطابعة أو تطبيقها اعرض مستوى المستهلكات.', en: 'View consumable levels on the printer screen or app.' },
            { ar: 'سجّل المستوى لكل خرطوشة.', en: 'Record the level per cartridge.' },
        ],
        expected: { ar: 'ظهور المستويات.', en: 'Levels shown.' },
        interpretation: { ar: 'مستوى منخفض يستلزم تجهيز بديل قبل الزيارة.', en: 'A low level means preparing a replacement before the visit.' },
        record: 'measurement', source: 'Printer vendor manual',
    }),

    // ── Network devices ──
    p({
        id: 'net_link', ar: 'حالة منافذ الشبكة', en: 'Network port/link status', categories: ['network'], os: ['any'], tier: 'observation',
        purpose: { ar: 'التأكد من وصلات المنافذ.', en: 'Confirm port links.' },
        steps: [
            { ar: 'افحص لمبات المنافذ على الجهاز.', en: 'Check the port LEDs on the device.' },
            { ar: 'سجّل المنافذ المضيئة/المطفأة.', en: 'Record which ports are lit/off.' },
        ],
        expected: { ar: 'إضاءة المنافذ المستخدمة.', en: 'Active ports are lit.' },
        interpretation: { ar: 'منفذ مستخدم بلا إضاءة يحتاج فحص الكابل/الجهاز المقابل.', en: 'An active port with no light needs cable/peer checks.' },
        record: 'result', source: 'Device vendor manual',
    }),
    p({
        id: 'net_ping_gateway', ar: 'اختبار الاتصال بالبوابة', en: 'Ping the gateway', categories: ['network'], os: ['any'], tier: 'builtin_cmd',
        purpose: { ar: 'التأكد من الوصول لجهاز الشبكة.', en: 'Confirm reachability of the network device.' },
        app: { ar: 'موجّه الأوامر / Terminal', en: 'Command Prompt / Terminal' }, command: 'ping <gateway-ip>',
        steps: [
            { ar: 'احصل على عنوان البوابة من الجهاز المتصل.', en: 'Get the gateway IP from a connected device.' },
            { ar: 'نفّذ ping للعنوان وسجّل الفقد.', en: 'Ping the address; record loss.' },
        ],
        expected: { ar: 'وصول الرد بفقد 0%.', en: 'Replies with 0% loss.' },
        interpretation: { ar: 'عدم الوصول يعني مشكلة شبكة تحتاج مراجعة.', en: 'No reply indicates a network issue needing review.' },
        record: 'result', source: 'Microsoft Learn / man-pages: ping',
    }),

    // ── CCTV: IP vs analog are deliberately distinct ──
    p({
        id: 'cctv_ip_live', ar: 'العرض الحي لكاميرات IP', en: 'IP cameras live view', categories: ['cctv_ip'], os: ['any'], tier: 'vendor',
        purpose: { ar: 'التأكد من ظهور كل كاميرا IP.', en: 'Confirm each IP camera shows a feed.' },
        app: { ar: 'واجهة NVR / تطبيق النظام', en: 'NVR UI / system app' },
        steps: [
            { ar: 'ادخل واجهة NVR أو تطبيق النظام.', en: 'Open the NVR UI or system app.' },
            { ar: 'استعرض العرض الحي لكل كاميرا.', en: 'Open the live view for each camera.' },
            { ar: 'سجّل عدد الكاميرات الظاهرة مقابل الإجمالي وأي كاميرا بلا صورة.', en: 'Record cameras showing vs total, and any with no image.' },
        ],
        expected: { ar: 'ظهور صورة حية لكل الكاميرات.', en: 'A live image for every camera.' },
        interpretation: { ar: 'كاميرا بلا صورة تحتاج فحص الشبكة/التغذية (PoE) للكاميرا.', en: 'A blank camera needs network/PoE checks.' },
        record: 'measurement', source: 'CCTV/NVR vendor manual',
    }),
    p({
        id: 'cctv_ip_recording', ar: 'تسجيل كاميرات IP والتخزين', en: 'IP recording & storage', categories: ['cctv_ip'], os: ['any'], tier: 'vendor',
        purpose: { ar: 'التأكد من التسجيل ومدة الاحتفاظ.', en: 'Confirm recording and retention.' },
        app: { ar: 'واجهة NVR', en: 'NVR UI' },
        steps: [
            { ar: 'من قائمة NVR افتح حالة التسجيل وصحة القرص.', en: 'In the NVR menu open recording status and disk health.' },
            { ar: 'استعرض تسجيلاً سابقاً للتأكد من وجوده.', en: 'Play back an earlier recording to confirm it exists.' },
            { ar: 'سجّل مدة الاحتفاظ وحالة القرص.', en: 'Record retention period and disk status.' },
        ],
        expected: { ar: 'وجود تسجيل مستمر وقرص سليم.', en: 'Continuous recording and a healthy disk.' },
        interpretation: { ar: 'انقطاع التسجيل أو خطأ قرص يحتاج معالجة قبل الاعتماد.', en: 'Recording gaps or disk errors need attention before sign-off.' },
        record: 'result', source: 'CCTV/NVR vendor manual',
    }),
    p({
        id: 'cctv_analog_live', ar: 'العرض الحي للكاميرات التناظرية', en: 'Analog cameras live view', categories: ['cctv_analog'], os: ['any'], tier: 'vendor',
        purpose: { ar: 'التأكد من ظهور كل قناة على DVR.', en: 'Confirm each channel shows on the DVR.' },
        app: { ar: 'واجهة DVR', en: 'DVR UI' },
        steps: [
            { ar: 'ادخل واجهة DVR.', en: 'Open the DVR UI.' },
            { ar: 'استعرض كل قناة على حدة.', en: 'View each channel individually.' },
            { ar: 'سجّل القنوات الظاهرة مقابل الإجمالي وأي قناة بلا إشارة.', en: 'Record channels showing vs total, and any with no signal.' },
        ],
        expected: { ar: 'ظهور صورة لكل القنوات.', en: 'An image on every channel.' },
        interpretation: { ar: 'قناة بلا إشارة تحتاج فحص الكابل المحوري/التغذية للكاميرا.', en: 'A no-signal channel needs coax/power checks.' },
        record: 'measurement', source: 'DVR vendor manual',
    }),
    p({
        id: 'cctv_analog_recording', ar: 'تسجيل DVR والتخزين', en: 'DVR recording & storage', categories: ['cctv_analog'], os: ['any'], tier: 'vendor',
        purpose: { ar: 'التأكد من التسجيل ومساحة القرص.', en: 'Confirm recording and disk space.' },
        app: { ar: 'واجهة DVR', en: 'DVR UI' },
        steps: [
            { ar: 'من قائمة DVR افتح حالة التسجيل وصحة القرص.', en: 'In the DVR menu open recording status and disk health.' },
            { ar: 'استعرض تسجيلاً سابقاً.', en: 'Play back an earlier recording.' },
            { ar: 'سجّل مدة الاحتفاظ وحالة القرص.', en: 'Record retention and disk status.' },
        ],
        expected: { ar: 'تسجيل مستمر وقرص سليم.', en: 'Continuous recording and a healthy disk.' },
        interpretation: { ar: 'انقطاع التسجيل أو خطأ قرص يحتاج معالجة.', en: 'Recording gaps or disk errors need attention.' },
        record: 'result', source: 'DVR vendor manual',
    }),
];

// Pick the applicable procedures for one asset, simplest method first.
// If the OS is not yet confirmed for a computer-type asset, return only the identification procedure.
export function selectDiagnostics(asset: { category?: string; os_family?: string }): DiagProc[] {
    const cat = asset.category || '';
    const os = asset.os_family || '';
    const COMPUTER = ['windows_pc', 'laptop', 'linux', 'macbook', 'aio', 'server', 'storage'];
    const needsOs = COMPUTER.includes(cat);
    if (needsOs && (!os || os === 'na')) return [IDENTIFY_OS];

    const matched = PROCS.filter(pr =>
        (pr.categories.includes('any') || pr.categories.includes(cat)) &&
        (pr.os.includes('any') || pr.os.includes(os))
    );
    matched.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
    // always let the technician re-confirm identity if they want
    return needsOs ? [IDENTIFY_OS, ...matched] : matched;
}
