/** Display-only Coinbase BTC-USD trade ticker. No predictions, bets, or orders. */
'use strict';
(() => {
  const priceNode = document.getElementById('live-price');
  const timeNode = document.getElementById('live-trade-time');
  const ageNode = document.getElementById('live-data-age');
  const statusNode = document.getElementById('live-status');
  const statusText = document.getElementById('live-status-text');
  if (![priceNode, timeNode, ageNode, statusNode, statusText].every(Boolean)) return;

  const money = new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2});
  const feedUrl='wss://ws-feed.exchange.coinbase.com';
  let socket=null, retryTimer=null, retries=0, tradeTime=0, receivedAt=0, heartbeatAt=0;
  let lastSeq=-1, missedMessages=false, stopped=false;

  const setStatus=(kind, label)=>{
    statusNode.dataset.state=kind;
    statusText.textContent=label;
  };
  function freshness(){
    const now=Date.now();
    const connected=socket?.readyState===WebSocket.OPEN;
    if(!tradeTime){
      ageNode.textContent='No valid trade received';
      setStatus(connected?'connecting':'offline',connected?'Waiting for first trade':'Feed unavailable');
      return;
    }
    const ageSec=Math.max(0,Math.floor((now-tradeTime)/1000));
    ageNode.textContent='Last trade '+ageSec+'s ago';
    if(!connected){setStatus('offline','Disconnected · last recorded trade');return;}
    if(now-tradeTime>30000 || now-receivedAt>30000){setStatus('stale','Trade quote is stale');return;}
    if(heartbeatAt && now-heartbeatAt>15000){setStatus('stale','Exchange heartbeat overdue');return;}
    if(missedMessages){setStatus('stale','Data gap detected · reconnecting');return;}
    setStatus('live','Receiving recent trades');
  }
  function reconnect(){
    if(stopped||retryTimer!==null)return;
    const ms=Math.min(30000,1000*2**Math.min(retries++,5));
    retryTimer=setTimeout(()=>{retryTimer=null;connect();},ms);
  }
  function connect(){
    if(stopped)return;
    if(!('WebSocket' in window)){setStatus('offline','Browser does not support live feed');return;}
    if(socket && [WebSocket.OPEN,WebSocket.CONNECTING].includes(socket.readyState))return;
    setStatus('connecting','Connecting to Coinbase Exchange');
    try{
      const ws=new WebSocket(feedUrl);
      socket=ws;
      ws.addEventListener('open',()=>{
        if(socket!==ws)return;
        retries=0; lastSeq=-1; missedMessages=false;
        ws.send(JSON.stringify({type:'subscribe',product_ids:['BTC-USD'],channels:['ticker','heartbeat']}));
        freshness();
      });
      ws.addEventListener('message',(event)=>{
        if(socket!==ws)return;
        let data;
        try{data=JSON.parse(event.data);}catch{return;}
        if(data.product_id!=='BTC-USD')return;
        if(data.type==='heartbeat'){heartbeatAt=Date.now();return;}
        if(data.type!=='ticker')return;
        const price=Number(data.price),stamp=Date.parse(data.time);
        if(!Number.isFinite(price)||price<=0||!Number.isFinite(stamp))return;
        if(stamp>Date.now()+30000 || (tradeTime && stamp<tradeTime))return;
        const seq=Number(data.sequence);
        if(Number.isSafeInteger(seq)&&seq>=0){
          if(lastSeq>=0 && seq<=lastSeq)return;
          // The Coinbase ticker channel can batch trades and its sequence is not
          // guaranteed to advance by one for each emitted ticker event.
          lastSeq=seq;
        }
        tradeTime=stamp;receivedAt=Date.now();
        priceNode.textContent=money.format(price);
        timeNode.textContent=new Date(stamp).toLocaleString('en-US',{
          timeZone:'UTC',year:'numeric',month:'short',day:'numeric',
          hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false
        })+' UTC';
        freshness();
      });
      ws.addEventListener('error',()=>{if(socket===ws)ws.close();});
      ws.addEventListener('close',()=>{if(socket!==ws)return;socket=null;freshness();reconnect();});
    }catch{socket=null;freshness();reconnect();}
  }
  const checker=setInterval(freshness,5000);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){freshness();if(!socket && retryTimer===null)connect();}
  });
  window.addEventListener('pagehide',()=>{
    stopped=true;clearInterval(checker);
    if(retryTimer!==null)clearTimeout(retryTimer);
    if(socket)socket.close();
  });
  connect();
})();