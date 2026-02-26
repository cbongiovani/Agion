/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Analistas from './pages/Analistas';
import Aprovacao from './pages/Aprovacao';
import Atividades from './pages/Atividades';
import AvaliacaoSupervisores from './pages/AvaliacaoSupervisores';
import Avaliacoes from './pages/Avaliacoes';
import Certificados from './pages/Certificados';
import Dashboard from './pages/Dashboard';
import DashboardOKR from './pages/DashboardOKR';
import FechamentoSemanal from './pages/FechamentoSemanal';
import GestaoUsuarios from './pages/GestaoUsuarios';
import Home from './pages/Home';
import Logs from './pages/Logs';
import ManualSupervisor from './pages/ManualSupervisor';
import MeuPerfil from './pages/MeuPerfil';
import PerfilAnalista from './pages/PerfilAnalista';
import QuizzRelampago from './pages/QuizzRelampago';
import Ranking from './pages/Ranking';
import RelatorioSemanal from './pages/RelatorioSemanal';
import Supervisores from './pages/Supervisores';
import WarRoom from './pages/WarRoom';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Analistas": Analistas,
    "Aprovacao": Aprovacao,
    "Atividades": Atividades,
    "AvaliacaoSupervisores": AvaliacaoSupervisores,
    "Avaliacoes": Avaliacoes,
    "Certificados": Certificados,
    "Dashboard": Dashboard,
    "DashboardOKR": DashboardOKR,
    "FechamentoSemanal": FechamentoSemanal,
    "GestaoUsuarios": GestaoUsuarios,
    "Home": Home,
    "Logs": Logs,
    "ManualSupervisor": ManualSupervisor,
    "MeuPerfil": MeuPerfil,
    "PerfilAnalista": PerfilAnalista,
    "QuizzRelampago": QuizzRelampago,
    "Ranking": Ranking,
    "RelatorioSemanal": RelatorioSemanal,
    "Supervisores": Supervisores,
    "WarRoom": WarRoom,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};