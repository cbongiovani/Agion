import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

export default function ClockWidget() {
  const [dateTime, setDateTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Cuiaba',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('pt-BR', {
      timeZone: 'America/Cuiaba',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-[#0f1f35] border border-gray-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-[#ADF802]" />
        <span className="text-lg font-bold text-white tabular-nums">
          {formatTime(dateTime)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-400" />
        <span className="text-xs text-gray-300 capitalize">
          {formatDate(dateTime)}
        </span>
      </div>
    </div>
  );
}