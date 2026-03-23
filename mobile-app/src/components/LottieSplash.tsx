import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';

type LottieSplashProps = {
  onFinish: () => void;
};

export const LottieSplash = ({ onFinish }: LottieSplashProps) => {
  const finishedRef = useRef(false);

  useEffect(() => {
    return () => {
      finishedRef.current = true;
    };
  }, []);

  const handleAnimationFinish = () => {
    if (finishedRef.current) {
      return;
    }

    finishedRef.current = true;
    onFinish();
  };

  return (
    <View style={styles.container}>
      <LottieView
        source={require('../../assets/mandasplash.json')}
        autoPlay
        loop={false}
        resizeMode="contain"
        style={styles.animation}
        onAnimationFinish={handleAnimationFinish}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: {
    width: 180,
    height: 180,
  },
});
