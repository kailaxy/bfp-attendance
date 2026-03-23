import { useCallback, useEffect, useState } from 'react';
import { AppEntry } from './src';
import { LottieSplash } from './src/components/LottieSplash';
import { markAppOpenedAtNow, refreshAllMenuRecordsInBackground } from './src/services';

export default function App() {
	const [isSplashDone, setIsSplashDone] = useState(false);

	useEffect(() => {
		void markAppOpenedAtNow();
		void refreshAllMenuRecordsInBackground({ force: true });
	}, []);

	const handleSplashFinish = useCallback(() => {
		setIsSplashDone(true);
	}, []);

	if (!isSplashDone) {
		return <LottieSplash onFinish={handleSplashFinish} />;
	}

	return <AppEntry />;
}
