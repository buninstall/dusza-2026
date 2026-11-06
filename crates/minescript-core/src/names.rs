use std::collections::HashMap;
use std::hash::{BuildHasherDefault, Hasher};

const FNV_OFFSET: u64 = 0xcbf2_9ce4_8422_2325;
const FNV_PRIME: u64 = 0x0100_0000_01b3;

pub(crate) struct NameHasher(u64);

impl Default for NameHasher {
    fn default() -> Self {
        Self(FNV_OFFSET)
    }
}

impl Hasher for NameHasher {
    fn finish(&self) -> u64 {
        self.0
    }

    fn write(&mut self, bytes: &[u8]) {
        for &byte in bytes {
            self.0 = (self.0 ^ u64::from(byte)).wrapping_mul(FNV_PRIME);
        }
    }
}

pub(crate) type NameMap<K, V> = HashMap<K, V, BuildHasherDefault<NameHasher>>;
