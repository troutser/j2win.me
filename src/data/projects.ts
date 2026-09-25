// Replace these with your real projects.
export interface Project {
  name: string;
  description: string;
  tags: string[];
  repo?: string;
  url?: string;
  status?: 'active' | 'archived' | 'wip';
}

export const projects: Project[] = [
  {
    name: 'portscout',
    description: 'Async TCP port scanner with service banner grabbing and JSON output. Built to learn how nmap works under the hood.',
    tags: ['Python', 'asyncio', 'networking'],
    repo: 'https://github.com/troutser',
    status: 'active',
  },
  {
    name: 'jwt-autopsy',
    description: 'CLI that decodes, inspects and fuzzes JSON Web Tokens — flags alg:none, weak HMAC secrets and missing claims.',
    tags: ['Go', 'web security', 'CLI'],
    repo: 'https://github.com/troutser',
    status: 'wip',
  },
  {
    name: 'ctf-writeups',
    description: 'Collection of solutions and scripts from CTF competitions: pwn, crypto, web and forensics.',
    tags: ['CTF', 'pwn', 'crypto'],
    repo: 'https://github.com/troutser',
    status: 'active',
  },
  {
    name: 'honeylog',
    description: 'Tiny SSH honeypot that logs credential attempts and attacker commands to a searchable dashboard.',
    tags: ['TypeScript', 'Docker', 'blue team'],
    repo: 'https://github.com/troutser',
    status: 'archived',
  },
];
