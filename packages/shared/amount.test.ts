import {it,expect} from 'vitest';
import {compareAmounts} from './amount';
it('ranks sub-unit offers exactly even above IEEE754 integer precision',()=>{expect(compareAmounts('99999999999999999999.000002','99999999999999999999.000001')).toBe(1);expect(compareAmounts('9960.000000','9960')).toBe(0);});
