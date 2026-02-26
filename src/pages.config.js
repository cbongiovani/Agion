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
import MeuPerfil from './pages/MeuPerfil';
import Aprovacao from './pages/Aprovacao';
import Ranking from './pages/Ranking';
import ManualSupervisor from './pages/ManualSupervisor';
import RelatorioSemanal from './pages/RelatorioSemanal';
import Dashboard from './pages/Dashboard';
import Avaliacoes from './pages/Avaliacoes';
import Certificados from './pages/Certificados';
import WarRoom from './pages/WarRoom';
import QuizzRelampago from './pages/QuizzRelampago';
import Home from './pages/Home';
import Supervisores from './pages/Supervisores';
import FechamentoSemanal from './pages/FechamentoSemanal';
import Analistas from './pages/Analistas';
import PerfilAnalista from './pages/PerfilAnalista';
import Logs from './pages/Logs';
import GestaoUsuarios from './pages/GestaoUsuarios';
import Atividades from './pages/Atividades';
import __Layout from './Layout.jsx';


export const PAGES = {
    "MeuPerfil": MeuPerfil,
    "Aprovacao": Aprovacao,
    "Ranking": Ranking,
    "ManualSupervisor": ManualSupervisor,
    "RelatorioSemanal": RelatorioSemanal,
    "Dashboard": Dashboard,
    "Avaliacoes": Avaliacoes,
    "Certificados": Certificados,
    "WarRoom": WarRoom,
    "QuizzRelampago": QuizzRelampago,
    "Home": Home,
    "Supervisores": Supervisores,
    "FechamentoSemanal": FechamentoSemanal,
    "Analistas": Analistas,
    "PerfilAnalista": PerfilAnalista,
    "Logs": Logs,
    "GestaoUsuarios": GestaoUsuarios,
    "Atividades": Atividades,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};