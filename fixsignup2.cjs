const fs = require('fs');
const p = 'src/app/(auth)/sign-up/page.tsx';
let s = fs.readFileSync(p, 'utf8');
const old = '       await apiFetch<{ message?: string }>("/api/auth/signup", {\n         method: "POST",\n         body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),\n       });\n       try {';
const neu = '       const signupRes = await apiFetch<{ message?: string }>("/api/auth/signup", {\n         method: "POST",\n         body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),\n       });\n       if (signupRes?.message === "already registered, please sign in") {\n         setError("This email is already registered. Please sign in.");\n         router.push("/sign-in");\n         return;\n       }\n       setSuccess("Account created successfully. Logging you in…");\n       try {';
if (!s.includes(old)) { console.log('old not found'); process.exit(1); }
s = s.replace(old, neu);
const old2 = '       } catch {\n         router.push("/sign-in");\n       }';
const neu2 = '       } catch {\n         setSuccess("Account created. Please sign in to continue.");\n         router.push("/sign-in");\n       }';
if (!s.includes(old2)) { console.log('old2 not found'); process.exit(1); }
s = s.replace(old2, neu2);
fs.writeFileSync(p, s);
console.log('done');
