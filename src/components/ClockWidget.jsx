import React, { useState, useEffect } from 'react';
import { Clock, Calendar, MapPin } from 'lucide-react';

export default function ClockWidget() {
  const [dateTime, setDateTime] = useState(new Date());
  const [location, setLocation] = useState('Carregando...');
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Detectar timezone automático do navegador
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimeZone(detectedTz);

    // Tentar obter localização via geolocalização
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            // Usar API de geocoding reverso para obter cidade
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`
            );
            const data = await response.json();
            const city = data.address?.city || data.address?.town || data.address?.state || 'Localização detectada';
            setLocation(city);
          } catch (error) {
            setLocation(getCityFromTimezone(detectedTz));
          }
        },
        () => {
          // Se usuário negar permissão, usar cidade baseada no timezone
          setLocation(getCityFromTimezone(detectedTz));
        }
      );
    } else {
      setLocation(getCityFromTimezone(detectedTz));
    }
  }, []);

  const getCityFromTimezone = (tz) => {
    // Extrair cidade do timezone (ex: America/Cuiaba -> Cuiabá)
    const parts = tz.split('/');
    if (parts.length > 1) {
      return parts[parts.length - 1].replace(/_/g, ' ');
    }
    return tz;
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('pt-BR', {
      timeZone: timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('pt-BR', {
      timeZone: timeZone,
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
      <div className="flex items-center gap-2 pt-1 border-t border-gray-700">
        <MapPin className="w-3 h-3 text-[#ADF802]" />
        <span className="text-xs text-gray-400">
          {location}
        </span>
      </div>
    </div>
  );
}