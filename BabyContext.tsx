import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getBabyProfile, saveBabyProfile, BabyProfile } from './services/database';
import { useAuth } from './AuthContext';

interface BabyContextType {
    babyName: string;
    birthDate: string;
    isLoading: boolean;
    updateBabyProfile: (name: string, birthDate: string) => Promise<void>;
}

const BabyContext = createContext<BabyContextType | undefined>(undefined);

export const useBaby = () => {
    const context = useContext(BabyContext);
    if (!context) {
        throw new Error('useBaby must be used within a BabyProvider');
    }
    return context;
};

export const BabyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [babyName, setBabyName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Load baby profile when user changes
    useEffect(() => {
        const loadProfile = async () => {
            if (!user) {
                setBabyName('');
                setBirthDate('');
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const profile = await getBabyProfile();
                if (profile) {
                    setBabyName(profile.name);
                    setBirthDate(profile.birthDate);
                } else {
                    setBabyName('');
                    setBirthDate('');
                }
            } catch (error) {
                console.error('Failed to load baby profile:', error);
            } finally {
                setIsLoading(false);
            }
        };

        loadProfile();
    }, [user]);

    const updateBabyProfile = async (name: string, newBirthDate: string) => {
        try {
            const result = await saveBabyProfile({ name, birthDate: newBirthDate });
            if (result) {
                setBabyName(name);
                setBirthDate(newBirthDate);
            }
        } catch (error) {
            console.error('Failed to save baby profile:', error);
        }
    };

    return (
        <BabyContext.Provider value={{ babyName, birthDate, isLoading, updateBabyProfile }}>
            {children}
        </BabyContext.Provider>
    );
};
