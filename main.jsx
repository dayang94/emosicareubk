import React from 'react'; import {createRoot} from 'react-dom/client'; import App from './App'; import './styles.css'
class EB extends React.Component{state={e:false};static getDerivedStateFromError(){return{e:true}}
  render(){return this.state.e?<div className="login card" style={{textAlign:'center'}}><h2>Maaf, berlaku ralat</h2><p>Sila muat semula halaman. Data anda selamat.</p><button className="pri" onClick={()=>location.reload()}>Muat Semula</button></div>:this.props.children}}
createRoot(document.getElementById('root')).render(<EB><App/></EB>)
