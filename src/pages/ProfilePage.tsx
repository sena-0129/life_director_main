import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Plus, X } from 'lucide-react';
import { LifeProfile } from '../types';
import { cn } from '../utils/cn';

export function ProfilePage({ onSave, initialData, onBack, onSwitch, profiles, onCreateNew }: { 
  onSave: (p: LifeProfile) => void | Promise<void>, 
  initialData: LifeProfile | null,
  onBack: () => void,
  onSwitch: (id: string) => void,
  profiles: LifeProfile[],
  onCreateNew: () => void
}) {
  const [formData, setFormData] = useState<LifeProfile>(initialData || {
    id: '',
    name: '李建国', // DEMO MODE PREFILL
    birthDate: '1950-10-01', // DEMO MODE PREFILL
    birthPlace: '北京', // DEMO MODE PREFILL
    gender: '男',
    occupation: '中学高级教师', // DEMO MODE PREFILL
    cities: ['北京', '上海'], // DEMO MODE PREFILL
    avatar: `https://picsum.photos/seed/${Date.now()}/200/200`,
    bio: '我是一名退休的中学语文教师，教书育人四十余载。热爱书法和太极拳，喜欢记录生活中的点点滴滴。' // DEMO MODE PREFILL
  });

  const [cityInput, setCityInput] = useState('');

  const addCity = () => {
    if (cityInput && !formData.cities.includes(cityInput)) {
      setFormData({ ...formData, cities: [...formData.cities, cityInput] });
      setCityInput('');
    }
  };

  return (
    <motion.div 
      initial={{ x: '100%' }} 
      animate={{ x: 0 }} 
      exit={{ x: '-100%' }}
      className="flex-1 overflow-y-auto p-8 pb-32"
    >
      <div className="flex justify-between items-center mb-8">
        <button onClick={onBack} className="text-[#8E867A] flex items-center gap-1">
          <ChevronLeft /> 返回主页
        </button>
        <h2 className="text-2xl">人生档案</h2>
      </div>

      {/* Profile Switcher */}
      {profiles.length > 0 && (
        <div className="mb-10">
          <label className="label-text">切换档案</label>
          <div className="flex gap-3 overflow-x-auto pb-4 museum-scroll">
            {profiles.map(p => (
              <button 
                key={p.id}
                onClick={() => onSwitch(p.id)}
                className={cn(
                  "flex-shrink-0 w-16 h-16 rounded-full border-2 transition-all p-0.5",
                  initialData?.id === p.id ? "border-[#FF8C42] scale-110" : "border-[#E6E0D5] opacity-60"
                )}
              >
                <img src={p.avatar} alt={p.name} className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
              </button>
            ))}
            <button 
              onClick={onCreateNew}
              className="flex-shrink-0 w-16 h-16 rounded-full border-2 border-dashed border-[#8E867A] flex items-center justify-center text-[#8E867A]"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        <div className="flex flex-col items-center mb-8">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-[#FF8C42] shadow-xl mb-3">
            <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <button 
            onClick={() => setFormData({ ...formData, avatar: `https://picsum.photos/seed/${Date.now()}/200/200` })}
            className="text-[#FF8C42] text-sm font-semibold"
          >
            更换头像
          </button>
        </div>

        <div>
          <label className="label-text">姓名</label>
          <input 
            type="text" 
            className="input-field" 
            value={formData.name} 
            onChange={e => setFormData({ ...formData, name: e.target.value })} 
            placeholder="请输入您的姓名"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-text">出生日期</label>
            <input 
              type="date" 
              className="input-field" 
              value={formData.birthDate} 
              onChange={e => setFormData({ ...formData, birthDate: e.target.value })} 
            />
          </div>
          <div>
            <label className="label-text">性别</label>
            <select 
              className="input-field" 
              value={formData.gender} 
              onChange={e => setFormData({ ...formData, gender: e.target.value })}
            >
              <option>男</option>
              <option>女</option>
              <option>其他</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label-text">出生地点</label>
          <input 
            type="text" 
            className="input-field" 
            value={formData.birthPlace} 
            onChange={e => setFormData({ ...formData, birthPlace: e.target.value })} 
            placeholder="例如：北京"
          />
        </div>

        <div>
          <label className="label-text">当前职业 / 退休前职业</label>
          <input 
            type="text" 
            className="input-field" 
            value={formData.occupation} 
            onChange={e => setFormData({ ...formData, occupation: e.target.value })} 
            placeholder="例如：教师"
          />
        </div>

        <div>
          <label className="label-text">主要生活城市</label>
          <div className="flex gap-2 mb-2">
            <input 
              type="text" 
              className="input-field" 
              value={cityInput} 
              onChange={e => setCityInput(e.target.value)} 
              placeholder="填写城市名称并点击+号"
            />
            <button onClick={addCity} className="bg-[#E6E0D5] px-4 rounded-xl"><Plus /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.cities.map(city => (
              <span key={city} className="bg-[#FFF9F2] border border-[#E6E0D5] px-3 py-1 rounded-full text-sm flex items-center gap-1">
                {city} <X size={14} onClick={() => setFormData({ ...formData, cities: formData.cities.filter(c => c !== city) })} />
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="label-text">个人简介</label>
          <textarea 
            className="input-field h-24" 
            value={formData.bio} 
            onChange={e => setFormData({ ...formData, bio: e.target.value })} 
            placeholder="简单介绍一下您精彩的人生..."
          />
        </div>

        <button 
          onClick={() => onSave(formData)} 
          disabled={!formData.name || !formData.birthDate}
          className="btn-primary w-full mt-8 disabled:opacity-50"
        >
          保存档案
        </button>
      </div>
    </motion.div>
  );
}
