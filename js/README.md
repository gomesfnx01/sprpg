# ⚔️ Sistema Pessoal RPG

> Transforme suas metas diárias em missões, ganhe XP, suba de nível e colecione cards – tudo com uma estética retrô de RPG!

**Sistema Pessoal RPG** é um aplicativo web progressivo (PWA) para acompanhamento de metas pessoais com mecânicas de jogo. Ele combina produtividade com gamificação, incentivando você a manter uma rotina saudável, estudar, controlar finanças e muito mais.

---

## 🎯 Funcionalidades

- **Quests (Metas Diárias)** – Crie metas, marque as concluídas e ganhe XP. Uma vez marcada, a meta não pode ser desmarcada.
- **Vigor (Fitness)** – Defina uma meta de peso, registre seu peso e medidas a cada 15 dias, acompanhe treinos e ganhe XP proporcional ao esforço.
- **Inteligência (Estudos)** – Crie objetivos de estudo, registre sessões com tempo e notas, e ganhe XP baseado no tempo investido.
- **Tesouro (Finanças)** – Controle salário, dívidas fixas e gastos mensais. No fim do mês, ganhe XP com base na disciplina financeira.
- **Recompensas (Cards)** – Suba de nível geral para ganhar baús. Cada baú revela um card aleatório (Comum, Raro, Épico ou Lendário) que fica na sua coleção.
- **Personalização** – Escolha seu avatar, tema de cores (dourado, teal, roxo, etc.) e ambientação dia/noite automática ou manual.
- **Backup** – Exporte e importe todo o progresso em um arquivo JSON.
- **Offline First** – Funciona sem internet (graças ao Service Worker) e é instalável como um app no celular.

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 / CSS3** – Estrutura e estilo com identidade visual retrô.
- **JavaScript (Vanilla)** – Toda a lógica do app, sem dependências externas.
- **LocalStorage** – Persistência de dados (com fallback para IndexedDB em versões futuras).
- **Web Audio API** – Efeitos sonoros sintetizados e música ambiente.
- **Service Worker** – Cache para uso offline e instalação como PWA.
- **Node.js + Jimp** – Script auxiliar para otimizar imagens e gerar o `manifest.json` dos cards.

---

## 📦 Como Rodar Localmente

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/sistema-pessoal-rpg.git
cd sistema-pessoal-rpg